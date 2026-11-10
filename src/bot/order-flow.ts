import { createHash } from "node:crypto";
import { config } from "../app-config.js";
import { FileParseError, parseDocument } from "../domain/file-parsing.js";
import {
  countOrdersLastHour,
  createOrder,
  orderAmountKop,
  totalPages,
} from "../domain/orders.js";
import { formatUah } from "../domain/pricing.js";
import { isValidRoom, normalizeRoom } from "../domain/rooms.js";
import { getAnnouncement, isOrderingEnabled } from "../domain/settings.js";
import { paymentMethodLabel, type PaymentMethod } from "../domain/statuses.js";
import { logger } from "../infra/logger.js";
import { FileTooLargeError, downloadTelegramFile } from "../infra/telegram-file.js";
import { currentUser, type BotContext } from "./context.js";
import {
  backToMenuKeyboard,
  orderConfirmKeyboard,
  orderCopiesKeyboard,
  orderCreatedKeyboard,
  orderFilesKeyboard,
  roomRequiredKeyboard,
} from "./keyboards.js";
import { notifyStaff } from "./notify.js";
import {
  clearState,
  getState,
  setState,
  type ConversationState,
  type OrderDraft,
  type OrderFileDraft,
} from "./state.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

function conversationKey(ctx: BotContext): string {
  return String(ctx.from?.id ?? "unknown");
}

interface ActiveOrderState extends ConversationState {
  order: OrderDraft;
}

function hasOrder(state: ConversationState | undefined): state is ActiveOrderState {
  return Boolean(state?.order);
}

/** Захист від подвійного кліку по кнопці оплати. */
const submitting = new Set<number>();

export async function startNewOrder(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);

  if (!(await isOrderingEnabled())) {
    await editOrReply(
      ctx,
      texts.orderingDisabled(await getAnnouncement()),
      backToMenuKeyboard(),
    );
    return;
  }

  if (!user.fullName || !user.phone) {
    await editOrReply(ctx, texts.orderProfileIncomplete, backToMenuKeyboard());
    return;
  }

  if (!isValidRoom(user.location)) {
    await editOrReply(ctx, texts.orderRoomRequired, roomRequiredKeyboard());
    return;
  }

  setState(conversationKey(ctx), {
    step: "order_files",
    draft: {},
    order: { files: [], copies: 1 },
  });

  await editOrReply(ctx, texts.orderRules, orderFilesKeyboard(0));
}

export async function handleOrderDocument(ctx: BotContext): Promise<void> {
  const document = ctx.message?.document;
  if (!document) {
    return;
  }

  const key = conversationKey(ctx);
  const state = getState(key);

  if (!hasOrder(state) || state.step !== "order_files") {
    await replyHtml(ctx, texts.orderSendFilesOnly);
    return;
  }

  const order = state.order;

  if (order.files.length >= config.MAX_FILES_PER_ORDER) {
    await replyHtml(ctx, texts.orderLimitFiles(config.MAX_FILES_PER_ORDER));
    return;
  }

  try {
    await ctx.replyWithChatAction("upload_document");

    const bytes = await downloadTelegramFile(
      ctx.api,
      document.file_id,
      document.file_size,
    );
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    if (order.files.some((file) => file.sha256 === sha256)) {
      await replyHtml(ctx, texts.orderFileDuplicate, orderFilesKeyboard(order.files.length));
      return;
    }

    const parsed = await parseDocument(bytes);
    const pagesTotal = totalPages(order.files) + parsed.pages;

    if (pagesTotal > config.MAX_PAGES_PER_ORDER) {
      await replyHtml(
        ctx,
        texts.orderLimitPages(config.MAX_PAGES_PER_ORDER),
        orderFilesKeyboard(order.files.length),
      );
      return;
    }

    const file: OrderFileDraft = {
      fileId: document.file_id,
      fileName: document.file_name ?? `файл-${order.files.length + 1}`,
      mime: document.mime_type ?? "application/octet-stream",
      sizeBytes: document.file_size ?? bytes.length,
      pages: parsed.pages,
      pagesExact: parsed.pagesExact,
      sha256,
    };

    const updated: ActiveOrderState = {
      ...state,
      order: { ...order, files: [...order.files, file] },
    };
    setState(key, updated);

    await replyHtml(
      ctx,
      texts.orderFileAccepted({
        fileName: file.fileName,
        pages: file.pages,
        pagesExact: file.pagesExact,
        filesCount: updated.order.files.length,
        pagesTotal: totalPages(updated.order.files),
      }),
      orderFilesKeyboard(updated.order.files.length),
    );
  } catch (error) {
    if (error instanceof FileTooLargeError) {
      await replyHtml(
        ctx,
        texts.orderFileTooLarge(Math.round(config.MAX_FILE_SIZE_BYTES / 1024 / 1024)),
        orderFilesKeyboard(order.files.length),
      );
      return;
    }
    if (error instanceof FileParseError) {
      await replyHtml(
        ctx,
        texts.orderFileUnsupported(error.message),
        orderFilesKeyboard(order.files.length),
      );
      return;
    }
    logger.error(
      { err: error, fileName: document.file_name },
      "order file processing failed",
    );
    await replyHtml(
      ctx,
      texts.orderFileUnsupported("Сталася помилка під час обробки файлу."),
      orderFilesKeyboard(order.files.length),
    );
  }
}

export async function handleOrderText(
  ctx: BotContext,
  state: ConversationState,
): Promise<void> {
  const text = ctx.message?.text?.trim() ?? "";
  const key = conversationKey(ctx);

  if (state.step === "order_copies_custom") {
    if (!hasOrder(state)) {
      return;
    }
    if (!/^\d{1,2}$/.test(text)) {
      await ctx.reply(texts.orderCustomCopiesInvalid(config.MAX_COPIES), {
        parse_mode: "HTML",
      });
      return;
    }
    const copies = Number(text);
    if (copies < 1 || copies > config.MAX_COPIES) {
      await ctx.reply(texts.orderCustomCopiesInvalid(config.MAX_COPIES), {
        parse_mode: "HTML",
      });
      return;
    }
    await showSummary(ctx, {
      ...state,
      order: { ...state.order, copies },
    });
    return;
  }

  if (state.step === "order_comment") {
    if (!hasOrder(state)) {
      return;
    }
    if (text.length > 300) {
      await ctx.reply(texts.orderCommentTooLong, { parse_mode: "HTML" });
      return;
    }
    await showSummary(ctx, {
      ...state,
      order: { ...state.order, comment: text },
    });
    return;
  }

  if (state.step === "order_files") {
    await replyHtml(
      ctx,
      texts.orderSendFilesOnly,
      orderFilesKeyboard(hasOrder(state) ? state.order.files.length : 0),
    );
    return;
  }

  if (state.step === "order_copies") {
    await ctx.reply(texts.orderCustomCopies(config.MAX_COPIES), {
      parse_mode: "HTML",
      reply_markup: orderCopiesKeyboard(),
    });
    return;
  }

  if (state.step === "order_confirm") {
    await ctx.reply(`Оберіть спосіб оплати кнопкою нижче.`, {
      parse_mode: "HTML",
      reply_markup: orderConfirmKeyboard(Boolean(state.order?.comment)),
    });
    return;
  }

  clearState(key);
  await replyHtml(ctx, texts.fallback, backToMenuKeyboard());
}

export async function handleOrderCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  const key = conversationKey(ctx);
  const state = getState(key);

  if (!hasOrder(state)) {
    clearState(key);
    await editOrReply(
      ctx,
      `Чернетку замовлення втрачено. Почніть заново.`,
      backToMenuKeyboard(),
    );
    return;
  }

  if (data === "order:finish") {
    if (state.order.files.length === 0) {
      await replyHtml(ctx, texts.orderFilesNeed, orderFilesKeyboard(0));
      return;
    }
    await showCopies(ctx, state);
    return;
  }

  if (data === "order:remove") {
    const files = state.order.files.slice(0, -1);
    if (files.length === 0) {
      setState(key, { ...state, step: "order_files", order: { ...state.order, files } });
      await editOrReply(ctx, texts.orderRules, orderFilesKeyboard(0));
      return;
    }
    setState(key, { ...state, order: { ...state.order, files } });
    await editOrReply(
      ctx,
      texts.orderFileRemoved(files.length, totalPages(files)),
      orderFilesKeyboard(files.length),
    );
    return;
  }

  if (data === "order:files_back") {
    setState(key, { ...state, step: "order_files" });
    await editOrReply(ctx, texts.orderRules, orderFilesKeyboard(state.order.files.length));
    return;
  }

  if (data.startsWith("order:copies:")) {
    const copies = Number(data.slice("order:copies:".length));
    if (!Number.isInteger(copies) || copies < 1 || copies > config.MAX_COPIES) {
      await replyHtml(ctx, texts.orderCustomCopiesInvalid(config.MAX_COPIES));
      return;
    }
    await showSummary(ctx, { ...state, order: { ...state.order, copies } });
    return;
  }

  if (data === "order:copies_custom") {
    setState(key, { ...state, step: "order_copies_custom" });
    await editOrReply(ctx, texts.orderCustomCopies(config.MAX_COPIES), backToMenuKeyboard());
    return;
  }

  if (data === "order:copies_back") {
    await showCopies(ctx, state);
    return;
  }

  if (data === "order:comment") {
    setState(key, { ...state, step: "order_comment" });
    await editOrReply(ctx, texts.orderCommentPrompt, backToMenuKeyboard());
    return;
  }

  if (data === "order:pay:cash" || data === "order:pay:card_transfer") {
    const method: PaymentMethod = data === "order:pay:cash" ? "cash" : "card_transfer";
    await submitOrder(ctx, state, method);
    return;
  }
}

async function showCopies(
  ctx: BotContext,
  state: ActiveOrderState,
): Promise<void> {
  setState(conversationKey(ctx), { ...state, step: "order_copies" });
  await editOrReply(
    ctx,
    texts.orderAskCopies(totalPages(state.order.files)),
    orderCopiesKeyboard(),
  );
}

async function showSummary(
  ctx: BotContext,
  state: ActiveOrderState,
): Promise<void> {
  const user = currentUser(ctx);
  const copies = state.order.copies;
  const amount = orderAmountKop(state.order.files, copies, config.PRICE_PER_PAGE_KOP);

  setState(conversationKey(ctx), { ...state, step: "order_confirm" });

  await editOrReply(
    ctx,
    texts.orderSummary({
      files: state.order.files,
      copies,
      totalPages: totalPages(state.order.files),
      amount: formatUah(amount),
      room: normalizeRoom(user.location ?? "") ?? "—",
      phone: user.phone,
      comment: state.order.comment,
    }),
    orderConfirmKeyboard(Boolean(state.order.comment)),
  );
}

async function submitOrder(
  ctx: BotContext,
  state: ActiveOrderState,
  paymentMethod: PaymentMethod,
): Promise<void> {
  const user = currentUser(ctx);
  const room = normalizeRoom(user.location ?? "");

  if (!user.phone || !room) {
    clearState(conversationKey(ctx));
    await replyHtml(ctx, texts.orderRoomRequired, roomRequiredKeyboard());
    return;
  }

  if (!(await isOrderingEnabled())) {
    clearState(conversationKey(ctx));
    await replyHtml(
      ctx,
      texts.orderingDisabled(await getAnnouncement()),
      backToMenuKeyboard(),
    );
    return;
  }

  if (state.order.files.length === 0) {
    await replyHtml(ctx, texts.orderFilesNeed);
    return;
  }

  const submitterId = ctx.from?.id;
  if (submitterId && submitting.has(submitterId)) {
    return;
  }
  if (submitterId) {
    submitting.add(submitterId);
  }

  try {
    const recent = await countOrdersLastHour(user.id);
    if (recent >= config.ORDER_RATE_LIMIT_PER_HOUR) {
      await replyHtml(ctx, texts.orderRateLimited(config.ORDER_RATE_LIMIT_PER_HOUR));
      return;
    }

    try {
      const order = await createOrder({
        clientId: user.id,
        files: state.order.files.map((file) => ({
          fileId: file.fileId,
          fileName: file.fileName,
          mime: file.mime,
          sizeBytes: file.sizeBytes,
          pages: file.pages,
          pagesExact: file.pagesExact,
          sha256: file.sha256,
        })),
        copies: state.order.copies,
        comment: state.order.comment,
        location: room,
        phone: user.phone,
        paymentMethod,
        pricePerPageKop: config.PRICE_PER_PAGE_KOP,
      });

      clearState(conversationKey(ctx));

      const amount = formatUah(order.amountKop);
      const created = {
        code: order.code,
        amount,
        pages: order.pagesTotal,
        copies: order.copies,
        room: order.locationSnapshot,
      };

      await ctx.reply(
        paymentMethod === "cash"
          ? texts.orderCreatedCash(created)
          : texts.orderCreatedCard(created),
        { parse_mode: "HTML", reply_markup: orderCreatedKeyboard() },
      );

      await notifyStaff(
        ctx,
        texts.staffNewOrder({
          ...created,
          payment: paymentMethodLabel(paymentMethod),
          comment: order.comment ?? undefined,
        }),
      );
    } catch (error) {
      logger.error({ err: error }, "order creation failed");
      await replyHtml(ctx, texts.orderCreateFailed, backToMenuKeyboard());
    }
  } finally {
    if (submitterId) {
      submitting.delete(submitterId);
    }
  }
}
