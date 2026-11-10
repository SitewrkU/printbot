import { InlineKeyboard } from "grammy";
import { logger } from "../infra/logger.js";
import { formatUah } from "../domain/pricing.js";
import {
  OrderActionError,
  getOrderView,
  listClientOrders,
  listFreeQueue,
  listWorkerActive,
  markCashPaid,
  transitionOrder,
} from "../domain/queue.js";
import { isRole, isStaff, type Role } from "../domain/roles.js";
import {
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
} from "../domain/statuses.js";
import { displayName } from "../domain/users.js";
import { currentUser, type BotContext } from "./context.js";
import {
  backToMenuKeyboard,
  cashConfirmKeyboard,
  clientOrdersKeyboard,
  holdReasonsKeyboard,
  orderDetailKeyboard,
} from "./keyboards.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

const HOLD_REASONS: Record<string, string> = {
  broken: texts.holdReasonButton.broken,
  paper: texts.holdReasonButton.paper,
  client: texts.holdReasonButton.client,
};

function roleOf(user: { role: string }): Role {
  return isRole(user.role) ? user.role : "client";
}

function paymentLine(order: {
  paymentMethod: string;
  paymentStatus: string;
  status?: string;
}): string {
  const method = paymentMethodLabel(order.paymentMethod);
  const payment =
    order.paymentStatus === "paid"
      ? method
      : `${method} · ${paymentStatusLabel(order.paymentStatus)}`;
  return order.status === "ON_HOLD" ? `${payment} · ⚠️ пауза` : payment;
}

function parseOrderId(raw: string | undefined): bigint | null {
  if (!raw || !/^\d{1,15}$/.test(raw)) {
    return null;
  }
  return BigInt(raw);
}

export async function showQueue(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  const role = roleOf(user);

  if (!isStaff(role)) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const [free, mine] = await Promise.all([
    listFreeQueue(),
    listWorkerActive(user.id),
  ]);

  const sections: string[] = [];

  if (free.length > 0) {
    sections.push(
      `<b>Вільні</b>\n\n` +
        free
          .map((order) =>
            texts.queueItem({
              code: order.code,
              pages: order.pagesTotal,
              copies: order.copies,
              amount: formatUah(order.amountKop),
              location: order.locationSnapshot,
              payment: paymentLine(order),
              waiting: formatWaiting(order.createdAt),
            }),
          )
          .join("\n\n"),
    );
  }

  if (mine.length > 0) {
    sections.push(
      `<b>Мої в роботі</b>\n\n` +
        mine
          .map(
            (order) =>
              texts.queueItem({
                code: order.code,
                pages: order.pagesTotal,
                copies: order.copies,
                amount: formatUah(order.amountKop),
                location: order.locationSnapshot,
                payment: paymentLine(order),
                waiting: formatWaiting(order.createdAt),
              }),
          )
          .join("\n\n"),
    );
  }

  if (sections.length === 0) {
    sections.push(texts.queueHowTo);
  }

  const keyboard = new InlineKeyboard();
  for (const order of free) {
    keyboard.text(`▶️ ${order.code}`, `q:view:${order.id.toString()}`).row();
  }
  for (const order of mine) {
    keyboard.text(`🖨 ${order.code}`, `q:view:${order.id.toString()}`).row();
  }
  keyboard.text("🔄 Оновити", "menu:queue").text("◀️ Меню", "menu:main");

  await editOrReply(
    ctx,
    `${texts.queueHeader(free.length, mine.length)}\n\n${sections.join("\n\n")}`,
    keyboard,
  );
}

export async function showClientOrders(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  const orders = await listClientOrders(user.id);

  if (orders.length === 0) {
    await editOrReply(ctx, texts.ordersEmpty, backToMenuKeyboard());
    return;
  }

  const body = orders
    .map((order) =>
      texts.orderLine({
        code: order.code,
        status: statusLabel(order.status),
        amount: formatUah(order.amountKop),
        pages: order.pagesTotal,
        copies: order.copies,
      }),
    )
    .join("\n\n");

  await editOrReply(
    ctx,
    `<b>Мої замовлення</b>\n\n${body}\n\n${texts.ordersWithActions}`,
    clientOrdersKeyboard(
      orders.map((order) => ({
        id: order.id.toString(),
        code: order.code,
        status: order.status,
      })),
    ),
  );
}

export async function handleQueueCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  const user = currentUser(ctx);
  const staff = isStaff(roleOf(user));
  const [prefix, action, rawId, extra] = data.split(":");
  const orderId = parseOrderId(rawId);

  if (!staff) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }
  if (!orderId || !action) {
    await replyHtml(ctx, texts.orderNotFound);
    return;
  }

  if (action === "view") {
    await renderOrder(ctx, orderId);
    return;
  }

  const view = await getOrderView(orderId);
  if (!view) {
    await editOrReply(ctx, texts.orderNotFound, backToMenuKeyboard());
    return;
  }

  try {
    if (action === "take") {
      await transitionOrder({ orderId, to: "IN_PROGRESS", actorId: user.id });
      await notifyClient(ctx, view.client.telegramId, texts.orderTakenClient(view.code));
      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "ready") {
      await transitionOrder({
        orderId,
        to: "READY",
        actorId: user.id,
        requireAcceptedBy: roleOf(user) === "admin" ? undefined : user.id,
      });
      await notifyClient(
        ctx,
        view.client.telegramId,
        texts.orderReadyClient({ code: view.code, location: view.locationSnapshot }),
      );

      const updated = await getOrderView(orderId);
      if (updated && updated.paymentStatus !== "paid") {
        await ctx.reply(texts.cashQuestion(formatUah(updated.amountKop)), {
          parse_mode: "HTML",
          reply_markup: cashConfirmKeyboard(orderId.toString()),
        });
      }

      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "cash") {
      await markCashPaid(orderId, user.id);
      await ctx.reply(texts.cashConfirmed, { parse_mode: "HTML" });
      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "resume") {
      await transitionOrder({
        orderId,
        to: "IN_PROGRESS",
        actorId: user.id,
        requireAcceptedBy: roleOf(user) === "admin" ? undefined : user.id,
      });
      await notifyClient(ctx, view.client.telegramId, texts.orderResumedClient(view.code));
      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "hold") {
      await editOrReply(ctx, texts.holdReasons, holdReasonsKeyboard(orderId.toString()));
      return;
    }

    if (action === "holdr" && extra) {
      const reason = HOLD_REASONS[extra] ?? "потребує уточнення";
      await transitionOrder({
        orderId,
        to: "ON_HOLD",
        actorId: user.id,
        reason,
        requireAcceptedBy: roleOf(user) === "admin" ? undefined : user.id,
      });
      await notifyClient(
        ctx,
        view.client.telegramId,
        texts.orderHoldClient({ code: view.code, reason }),
      );
      await ctx.reply(texts.holdSet(reason), { parse_mode: "HTML" });
      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "files") {
      await sendOrderFiles(ctx, orderId);
      return;
    }

    await replyHtml(ctx, texts.orderActionNotAllowed);
  } catch (error) {
    if (error instanceof OrderActionError) {
      const message =
        error.code === "not_owner"
          ? texts.orderAlreadyTaken
          : texts.orderActionNotAllowed;
      await replyHtml(ctx, message);
      return;
    }
    logger.error({ err: error, data }, "queue action failed");
    await replyHtml(ctx, texts.orderActionNotAllowed);
  }
}

export async function handleClientOrderCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  const user = currentUser(ctx);
  const [, action, rawId] = data.split(":");
  const orderId = parseOrderId(rawId);

  if (!orderId || !action) {
    await replyHtml(ctx, texts.orderNotFound);
    return;
  }

  const view = await getOrderView(orderId);
  if (!view || view.clientId !== user.id) {
    await editOrReply(ctx, texts.orderNotFound, backToMenuKeyboard());
    return;
  }

  if (action === "view") {
    await renderOrder(ctx, orderId);
    return;
  }

  try {
    if (action === "cancel") {
      if (view.status !== "QUEUED") {
        await replyHtml(ctx, texts.orderActionNotAllowed);
        return;
      }
      await transitionOrder({
        orderId,
        to: "CANCELLED",
        actorId: user.id,
        reason: "скасовано клієнтом",
      });
      await ctx.reply(
        texts.orderCancelledClient({ code: view.code, reason: "скасовано клієнтом" }),
        { parse_mode: "HTML" },
      );
      await renderOrder(ctx, orderId);
      return;
    }

    if (action === "close") {
      if (view.status !== "READY") {
        await replyHtml(ctx, texts.orderActionNotAllowed);
        return;
      }
      await transitionOrder({ orderId, to: "CLOSED", actorId: user.id });
      await ctx.reply(texts.orderClosedClient(view.code), { parse_mode: "HTML" });
      await renderOrder(ctx, orderId);
      return;
    }

    await replyHtml(ctx, texts.orderActionNotAllowed);
  } catch (error) {
    if (error instanceof OrderActionError) {
      await replyHtml(ctx, texts.orderActionNotAllowed);
      return;
    }
    logger.error({ err: error, data }, "client order action failed");
    await replyHtml(ctx, texts.orderActionNotAllowed);
  }
}

async function renderOrder(ctx: BotContext, orderId: bigint): Promise<void> {
  const user = currentUser(ctx);
  const staff = isStaff(roleOf(user));
  const order = await getOrderView(orderId);

  if (!order || (!staff && order.clientId !== user.id)) {
    await editOrReply(ctx, texts.orderNotFound, backToMenuKeyboard());
    return;
  }

  const isMine = order.acceptedById === user.id;
  const keyboard = orderDetailKeyboard({
    orderId: order.id.toString(),
    code: order.code,
    isStaff: staff,
    isMine,
    status: order.status,
    paymentStatus: order.paymentStatus,
  });

  await editOrReply(
    ctx,
    texts.orderDetail({
      code: order.code,
      status: statusLabel(order.status),
      paymentStatus: paymentStatusLabel(order.paymentStatus),
      pages: order.pagesTotal,
      pagesExact: order.pagesExact,
      copies: order.copies,
      amount: formatUah(order.amountKop),
      location: order.locationSnapshot,
      phone: staff ? order.phoneSnapshot : null,
      comment: order.comment ?? undefined,
      clientName: staff ? displayName(order.client) : undefined,
      holdReason: order.holdReason ?? undefined,
      files: order.files,
      createdAt: order.createdAt,
    }),
    keyboard,
  );
}

async function sendOrderFiles(ctx: BotContext, orderId: bigint): Promise<void> {
  const order = await getOrderView(orderId);
  if (!order || !ctx.chat) {
    return;
  }

  let sent = 0;
  for (const file of order.files) {
    try {
      await ctx.api.sendDocument(ctx.chat.id, file.telegramFileId, {
        caption: file.fileName,
      });
      sent += 1;
    } catch (error) {
      logger.warn({ err: error, orderId: orderId.toString() }, "file resend failed");
    }
  }

  if (sent === 0) {
    await replyHtml(ctx, texts.orderFilesUnavailable);
  }
}

async function notifyClient(
  ctx: BotContext,
  telegramId: bigint,
  text: string,
): Promise<void> {
  try {
    await ctx.api.sendMessage(telegramId.toString(), text, { parse_mode: "HTML" });
  } catch (error) {
    logger.warn(
      { err: error, telegramId: telegramId.toString() },
      "client notification failed",
    );
  }
}

function formatWaiting(createdAt: Date): string {
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes} хв`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} год`;
}
