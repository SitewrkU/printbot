import { config } from "../app-config.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";
import { normalizePhone } from "../domain/phone.js";
import { canManageWorkers, isRole, type Role } from "../domain/roles.js";
import { addWorker, displayName, listWorkers, removeWorker, saveProfile } from "../domain/users.js";
import { currentUser, type BotContext } from "./context.js";
import {
  adminKeyboard,
  backToMenuKeyboard,
  confirmProfileKeyboard,
  confirmRemoveWorkerKeyboard,
  contactKeyboard,
  editProfileKeyboard,
  mainMenuKeyboard,
  profileKeyboard,
  workersKeyboard,
} from "./keyboards.js";
import { handleOrderCallback, handleOrderText, startNewOrder } from "./order-flow.js";
import {
  handleClientOrderCallback,
  handleQueueCallback,
  showClientOrders,
  showQueue,
} from "./queue-flow.js";
import {
  clearState,
  getState,
  isOrderStep,
  setState,
  type Draft,
  type Step,
} from "./state.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

function stateKey(ctx: BotContext): string {
  return String(ctx.from?.id ?? "unknown");
}

function roleOf(user: { role: string }): Role {
  return isRole(user.role) ? user.role : "client";
}

function profileComplete(user: {
  fullName: string | null;
  phone: string | null;
  location: string | null;
}): boolean {
  return Boolean(user.fullName && user.phone && user.location);
}

async function showMainMenu(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  await editOrReply(
    ctx,
    texts.mainMenu(user.fullName ?? undefined),
    mainMenuKeyboard(roleOf(user)),
  );
}

// ---------------------------------------------------------------- реєстрація

async function promptStep(
  ctx: BotContext,
  step: Step,
  draft: Draft,
): Promise<void> {
  switch (step) {
    case "reg_name":
      await ctx.reply(texts.askName, { parse_mode: "HTML" });
      return;
    case "reg_phone":
      await ctx.reply(texts.askPhone, {
        parse_mode: "HTML",
        reply_markup: contactKeyboard(),
      });
      return;
    case "reg_location":
      await ctx.reply(texts.askLocation, {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      });
      return;
    case "reg_confirm":
      await ctx.reply(texts.confirmProfile(draft), {
        parse_mode: "HTML",
        reply_markup: confirmProfileKeyboard(),
      });
      return;
    default:
      return;
  }
}

async function startOnboarding(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  const draft: Draft = {
    fullName: user.fullName ?? undefined,
    phone: user.phone ?? undefined,
    location: user.location ?? undefined,
  };

  const step: Step = !draft.fullName
    ? "reg_name"
    : !draft.phone
      ? "reg_phone"
      : !draft.location
        ? "reg_location"
        : "reg_confirm";

  setState(stateKey(ctx), { step, draft });
  await promptStep(ctx, step, draft);
}

export async function handleStart(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  clearState(stateKey(ctx));

  await ctx.reply(texts.welcome(user.fullName ?? undefined), {
    parse_mode: "HTML",
  });

  if (!profileComplete(user)) {
    await startOnboarding(ctx);
    return;
  }

  await ctx.reply(texts.mainMenu(user.fullName ?? undefined), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(roleOf(user)),
  });
}

// ------------------------------------------------------------------ профіль

async function showProfile(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  await editOrReply(
    ctx,
    texts.profile({
      fullName: user.fullName,
      phone: user.phone,
      location: user.location,
      role: roleOf(user),
    }),
    profileKeyboard(),
  );
}

// --------------------------------------------------------------------- зміни

async function saveName(ctx: BotContext, value: string): Promise<void> {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) {
    await ctx.reply(texts.invalidName, { parse_mode: "HTML" });
    return;
  }
  const state = getState(stateKey(ctx));
  if (!state) {
    return;
  }
  clearState(stateKey(ctx));
  ctx.user = await saveProfile(currentUser(ctx).id, { fullName: name });
  await ctx.reply(texts.profileUpdated, { parse_mode: "HTML" });
  await showProfile(ctx);
}

async function savePhone(ctx: BotContext, value: string): Promise<void> {
  const phone = normalizePhone(value);
  if (!phone) {
    await ctx.reply(texts.invalidPhone, { parse_mode: "HTML" });
    return;
  }
  clearState(stateKey(ctx));
  ctx.user = await saveProfile(currentUser(ctx).id, { phone });
  await ctx.reply(texts.profileUpdated, {
    parse_mode: "HTML",
    reply_markup: { remove_keyboard: true },
  });
  await showProfile(ctx);
}

async function saveLocation(ctx: BotContext, value: string): Promise<void> {
  const location = value.trim();
  if (location.length < 1 || location.length > 32) {
    await ctx.reply(texts.invalidLocation, { parse_mode: "HTML" });
    return;
  }
  clearState(stateKey(ctx));
  ctx.user = await saveProfile(currentUser(ctx).id, { location });
  await ctx.reply(texts.profileUpdated, { parse_mode: "HTML" });
  await showProfile(ctx);
}

// -------------------------------------------------------------------- адмін

async function showAdmin(ctx: BotContext): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }
  await editOrReply(ctx, texts.adminHome, adminKeyboard());
}

async function showWorkers(ctx: BotContext): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }
  const workers = await listWorkers();
  await editOrReply(ctx, texts.adminWorkers(workers.length), workersKeyboard(workers));
}

async function startAddWorker(ctx: BotContext): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }
  setState(stateKey(ctx), { step: "admin_add_worker", draft: {} });
  await editOrReply(
    ctx,
    texts.adminAskWorkerId,
    backToMenuKeyboard(),
  );
}

async function addWorkerFromText(ctx: BotContext, value: string): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    clearState(stateKey(ctx));
    await replyHtml(ctx, texts.adminOnly);
    return;
  }

  const raw = value.trim();
  if (!/^\d{5,15}$/.test(raw)) {
    await ctx.reply(texts.adminInvalidId, { parse_mode: "HTML" });
    return;
  }

  clearState(stateKey(ctx));
  await addWorker(BigInt(raw));
  await ctx.reply(texts.adminWorkerAdded(raw), { parse_mode: "HTML" });
  await showWorkers(ctx);
}

async function confirmRemoveWorker(ctx: BotContext, raw: string): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const worker = await prisma.user.findUnique({ where: { telegramId: BigInt(raw) } });
  if (!worker) {
    await editOrReply(ctx, texts.adminWorkerNotFound, backToMenuKeyboard());
    return;
  }
  if (worker.role === "admin") {
    await editOrReply(ctx, texts.adminCannotRemoveAdmin, backToMenuKeyboard());
    return;
  }

  await editOrReply(
    ctx,
    texts.adminConfirmRemove(displayName(worker)),
    confirmRemoveWorkerKeyboard(raw),
  );
}

async function removeWorkerById(ctx: BotContext, raw: string): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const worker = await prisma.user.findUnique({ where: { telegramId: BigInt(raw) } });
  if (!worker) {
    await editOrReply(ctx, texts.adminWorkerNotFound, backToMenuKeyboard());
    return;
  }
  if (worker.role === "admin") {
    await editOrReply(ctx, texts.adminCannotRemoveAdmin, backToMenuKeyboard());
    return;
  }

  await removeWorker(BigInt(raw));
  await ctx.reply(texts.adminWorkerRemoved(raw), { parse_mode: "HTML" });
  await showWorkers(ctx);
}

// ------------------------------------------------------------------ обробники

export async function handleText(ctx: BotContext): Promise<void> {
  const key = stateKey(ctx);
  const state = getState(key);

  if (!state) {
    await replyHtml(
      ctx,
      texts.fallback,
      mainMenuKeyboard(roleOf(currentUser(ctx))),
    );
    return;
  }

  if (isOrderStep(state.step)) {
    await handleOrderText(ctx, state);
    return;
  }

  const text = ctx.message?.text?.trim() ?? "";

  switch (state.step) {
    case "reg_name": {
      const name = text.replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 60) {
        await ctx.reply(texts.invalidName, { parse_mode: "HTML" });
        return;
      }
      const draft = { ...state.draft, fullName: name };
      setState(key, { step: "reg_phone", draft });
      await promptStep(ctx, "reg_phone", draft);
      return;
    }

    case "reg_phone": {
      const phone = normalizePhone(text);
      if (!phone) {
        await ctx.reply(texts.invalidPhone, { parse_mode: "HTML" });
        return;
      }
      const draft = { ...state.draft, phone };
      setState(key, { step: "reg_location", draft });
      await promptStep(ctx, "reg_location", draft);
      return;
    }

    case "reg_location": {
      const location = text.trim();
      if (location.length < 1 || location.length > 32) {
        await ctx.reply(texts.invalidLocation, { parse_mode: "HTML" });
        return;
      }
      const draft = { ...state.draft, location };
      setState(key, { step: "reg_confirm", draft });
      await promptStep(ctx, "reg_confirm", draft);
      return;
    }

    case "reg_confirm": {
      await ctx.reply(`Натисніть «✅ Все вірно» або «✏️ Змінити».`, {
        parse_mode: "HTML",
        reply_markup: confirmProfileKeyboard(),
      });
      return;
    }

    case "edit_name":
      await saveName(ctx, text);
      return;

    case "edit_phone":
      await savePhone(ctx, text);
      return;

    case "edit_location":
      await saveLocation(ctx, text);
      return;

    case "admin_add_worker":
      await addWorkerFromText(ctx, text);
      return;

    default:
      return;
  }
}

export async function handleContact(ctx: BotContext): Promise<void> {
  const contact = ctx.message?.contact;
  if (!contact) {
    return;
  }

  const state = getState(stateKey(ctx));
  if (state?.step !== "reg_phone") {
    await replyHtml(ctx, `Зараз номер телефону не потрібен. Скористайтеся /start.`);
    return;
  }

  if (
    contact.user_id &&
    ctx.from &&
    contact.user_id !== ctx.from.id
  ) {
    await replyHtml(ctx, `Будь ласка, надішліть власний номер.`);
    return;
  }

  const phone = normalizePhone(contact.phone_number);
  if (!phone) {
    await ctx.reply(texts.invalidPhone, { parse_mode: "HTML" });
    return;
  }

  const draft = { ...state.draft, phone };
  setState(stateKey(ctx), { step: "reg_location", draft });
  await promptStep(ctx, "reg_location", draft);
}

export async function handleCancel(ctx: BotContext): Promise<void> {
  clearState(stateKey(ctx));
  await ctx.reply(texts.cancelDone, { parse_mode: "HTML" });
  await showMainMenu(ctx);
}

export async function handleHelp(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  await ctx.reply(texts.help, {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(roleOf(user)),
  });
}

/** Допомагає дізнатися ID групового чату для STAFF_CHAT_ID. */
export async function handleChatId(ctx: BotContext): Promise<void> {
  if (!ctx.chat) {
    return;
  }
  await ctx.reply(`ID цього чату: <code>${ctx.chat.id}</code>`, {
    parse_mode: "HTML",
  });
}

/** Скріншот квитанції: пересилаємо працівникам, щоб вони підтвердили оплату. */
export async function handleReceipt(ctx: BotContext): Promise<void> {
  const message = ctx.message;
  if (!message) {
    return;
  }

  if (!config.STAFF_CHAT_ID) {
    await replyHtml(ctx, texts.receiptNoStaff);
    return;
  }

  try {
    await ctx.api.forwardMessage(config.STAFF_CHAT_ID, message.chat.id, message.message_id);
    await replyHtml(ctx, texts.receiptForwarded);
  } catch (error) {
    logger.warn({ err: error }, "receipt forward failed");
    await replyHtml(ctx, texts.receiptFailed);
  }
}

export async function handleAdminCommand(ctx: BotContext): Promise<void> {
  if (!canManageWorkers(roleOf(currentUser(ctx)))) {
    await replyHtml(ctx, texts.adminOnly);
    return;
  }
  await showAdmin(ctx);
}

export async function handleCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    return;
  }

  if (data.startsWith("admin:worker:")) {
    const raw = data.slice("admin:worker:".length);
    const worker = await prisma.user.findUnique({
      where: { telegramId: BigInt(raw) },
    });
    await ctx.answerCallbackQuery({
      text: worker ? `${displayName(worker)} · ID ${raw}` : `ID ${raw}`,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  try {
    if (data.startsWith("order:")) {
      await handleOrderCallback(ctx, data);
      return;
    }
    if (data.startsWith("q:")) {
      await handleQueueCallback(ctx, data);
      return;
    }
    if (data.startsWith("o:")) {
      await handleClientOrderCallback(ctx, data);
      return;
    }

    if (data === "menu:main") {
      clearState(stateKey(ctx));
      await showMainMenu(ctx);
      return;
    }
    if (data === "menu:new") {
      await startNewOrder(ctx);
      return;
    }
    if (data === "menu:orders") {
      await showClientOrders(ctx);
      return;
    }
    if (data === "menu:profile") {
      await showProfile(ctx);
      return;
    }
    if (data === "menu:help") {
      await editOrReply(ctx, texts.help, backToMenuKeyboard());
      return;
    }
    if (data === "menu:queue") {
      await showQueue(ctx);
      return;
    }
    if (data === "menu:admin") {
      await showAdmin(ctx);
      return;
    }

    if (data === "reg:confirm") {
      await confirmProfile(ctx);
      return;
    }
    if (data === "reg:restart") {
      clearState(stateKey(ctx));
      await startOnboarding(ctx);
      return;
    }

    if (data === "profile:name") {
      setState(stateKey(ctx), { step: "edit_name", draft: {} });
      await editOrReply(
        ctx,
        `Напишіть нове ім'я та прізвище.`,
        editProfileKeyboard(),
      );
      return;
    }
    if (data === "profile:phone") {
      setState(stateKey(ctx), { step: "edit_phone", draft: {} });
      await ctx.reply(texts.askPhone, {
        parse_mode: "HTML",
        reply_markup: contactKeyboard(),
      });
      return;
    }
    if (data === "profile:location") {
      setState(stateKey(ctx), { step: "edit_location", draft: {} });
      await editOrReply(ctx, texts.askLocation, editProfileKeyboard());
      return;
    }

    if (data === "admin:home") {
      await showAdmin(ctx);
      return;
    }
    if (data === "admin:workers") {
      await showWorkers(ctx);
      return;
    }
    if (data === "admin:add") {
      await startAddWorker(ctx);
      return;
    }
    if (data.startsWith("admin:remove_confirm:")) {
      await removeWorkerById(ctx, data.slice("admin:remove_confirm:".length));
      return;
    }
    if (data.startsWith("admin:remove:")) {
      await confirmRemoveWorker(ctx, data.slice("admin:remove:".length));
      return;
    }
  } catch (error) {
    logger.error({ err: error, data }, "callback handling failed");
    await replyHtml(ctx, `Сталася помилка. Спробуйте ще раз або натисніть /start.`);
  }
}

async function confirmProfile(ctx: BotContext): Promise<void> {
  const key = stateKey(ctx);
  const state = getState(key);

  if (!state || state.step !== "reg_confirm") {
    await replyHtml(ctx, `Дані неповні. Натисніть /start, щоб почати заново.`);
    return;
  }

  const { fullName, phone, location } = state.draft;
  if (!fullName || !phone || !location) {
    await replyHtml(ctx, `Дані неповні. Натисніть /start, щоб почати заново.`);
    return;
  }

  const user = currentUser(ctx);
  const updated = await saveProfile(user.id, { fullName, phone, location });
  ctx.user = updated;
  clearState(key);

  await ctx.reply(texts.profileSaved, {
    parse_mode: "HTML",
    reply_markup: { remove_keyboard: true },
  });
  await ctx.reply(texts.mainMenu(updated.fullName ?? undefined), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(roleOf(updated)),
  });
}
