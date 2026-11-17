import { InlineKeyboard } from "grammy";
import { config } from "../app-config.js";
import { createOrder } from "../domain/orders.js";
import { formatUah } from "../domain/pricing.js";
import { isRole, type Role } from "../domain/roles.js";
import { normalizeRoom } from "../domain/rooms.js";
import { paymentMethodLabel } from "../domain/statuses.js";
import {
  displayName,
  ensureShadowUser,
  findUserById,
  listRecentClients,
} from "../domain/users.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";
import { currentUser, type BotContext } from "./context.js";
import { backToMenuKeyboard, prankClientsKeyboard, prankOrdersKeyboard } from "./keyboards.js";
import { notifyStaff } from "./notify.js";
import { texts } from "./texts.js";
import { editOrReply } from "./utils.js";

function roleOf(user: { role: string }): Role {
  return isRole(user.role) ? user.role : "client";
}

function isAdmin(ctx: BotContext): boolean {
  return roleOf(currentUser(ctx)) === "admin";
}

const creating = new Set<string>();

export async function showPrankClients(ctx: BotContext): Promise<void> {
  if (!isAdmin(ctx)) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const clients = await listRecentClients();
  if (clients.length === 0) {
    await editOrReply(ctx, texts.prankEmpty, backToMenuKeyboard());
    return;
  }

  await editOrReply(ctx, texts.prankTitle, prankClientsKeyboard(clients));
}

export async function handlePrankCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  if (!isAdmin(ctx)) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  if (data === "admin:prank") {
    await showPrankClients(ctx);
    return;
  }

  if (data.startsWith("admin:prank:target:")) {
    await showPrankOrders(ctx, data.slice("admin:prank:target:".length));
    return;
  }

  if (data.startsWith("admin:prank:clone:")) {
    await cloneAsPrank(ctx, data.slice("admin:prank:clone:".length));
    return;
  }
}

async function showPrankOrders(
  ctx: BotContext,
  rawUserId: string,
): Promise<void> {
  if (!/^\d{1,19}$/.test(rawUserId)) {
    await editOrReply(ctx, texts.prankUserNotFound, backToMenuKeyboard());
    return;
  }

  const target = await findUserById(BigInt(rawUserId));
  if (
    !target ||
    target.role !== "client" ||
    target.telegramId < 0n ||
    !target.isActive
  ) {
    await editOrReply(ctx, texts.prankUserNotFound, backToMenuKeyboard());
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      clientId: target.id,
      status: { in: ["QUEUED", "IN_PROGRESS", "READY", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  if (orders.length === 0) {
    await editOrReply(
      ctx,
      texts.prankNoOrders(displayName(target)),
      backToMenuKeyboard(),
    );
    return;
  }

  await editOrReply(
    ctx,
    texts.prankChooseOrder({
      name: displayName(target),
      room: target.location,
    }),
    prankOrdersKeyboard(orders),
  );
}

async function cloneAsPrank(
  ctx: BotContext,
  rawOrderId: string,
): Promise<void> {
  if (!/^\d{1,19}$/.test(rawOrderId)) {
    await editOrReply(ctx, texts.prankFailed, backToMenuKeyboard());
    return;
  }

  const inFlightKey = `${ctx.from?.id ?? "0"}:${rawOrderId}`;
  if (creating.has(inFlightKey)) {
    return;
  }
  creating.add(inFlightKey);

  try {
    const original = await prisma.order.findUnique({
      where: { id: BigInt(rawOrderId) },
      include: { files: true, client: true },
    });

    if (!original || original.files.length === 0) {
      await editOrReply(ctx, texts.prankFailed, backToMenuKeyboard());
      return;
    }

    const target = original.client;
    if (
      target.role !== "client" ||
      target.telegramId < 0n ||
      !target.isActive ||
      !target.fullName
    ) {
      await editOrReply(ctx, texts.prankFailed, backToMenuKeyboard());
      return;
    }

    const room =
      normalizeRoom(target.location ?? "") ?? original.locationSnapshot;
    const shadow = await ensureShadowUser(target);

    const order = await createOrder({
      clientId: shadow.id,
      files: original.files.map((file) => ({
        fileId: file.telegramFileId,
        fileName: file.fileName,
        mime: file.mime ?? "application/octet-stream",
        sizeBytes: file.sizeBytes ?? 0,
        pages: file.pages,
        pagesExact: file.pagesExact,
        sha256: file.sha256 ?? "",
      })),
      copies: original.copies,
      comment: original.comment ?? undefined,
      location: room,
      phone: target.phone,
      paymentMethod: "cash",
      pricePerPageKop: config.PRICE_PER_PAGE_KOP,
    });

    await notifyStaff(
      ctx,
      texts.staffNewOrder({
        code: order.code,
        pages: order.pagesTotal,
        copies: order.copies,
        amount: formatUah(order.amountKop),
        room: order.locationSnapshot,
        payment: paymentMethodLabel("cash"),
        comment: order.comment ?? undefined,
      }),
    );

    await editOrReply(
      ctx,
      texts.prankCreated(order.code),
      new InlineKeyboard()
        .text("🎭 Ще один", "admin:prank")
        .row()
        .text("🏠 Меню", "menu:main"),
    );
  } catch (error) {
    logger.error(
      { err: error, orderId: rawOrderId },
      "prank order creation failed",
    );
    await editOrReply(ctx, texts.prankFailed, backToMenuKeyboard());
  } finally {
    creating.delete(inFlightKey);
  }
}
