import { createHash } from "node:crypto";
import type { Order } from "@prisma/client";
import { InlineKeyboard } from "grammy";
import { config } from "../app-config.js";
import { FileParseError, parseDocument } from "../domain/file-parsing.js";
import { createOrder } from "../domain/orders.js";
import {
  markupForClient,
  markupNote,
  pricePerPageWithMarkup,
} from "../domain/markup.js";
import { formatUah } from "../domain/pricing.js";
import { isRole, type Role } from "../domain/roles.js";
import { normalizeRoom } from "../domain/rooms.js";
import { paymentMethodLabel } from "../domain/statuses.js";
import {
  displayName,
  ensureShadowUser,
  findUserById,
  listActiveClients,
} from "../domain/users.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";
import {
  FileTooLargeError,
  downloadTelegramFile,
} from "../infra/telegram-file.js";
import { currentUser, type BotContext } from "./context.js";
import {
  backToMenuKeyboard,
  prankClientsKeyboard,
  prankOrdersKeyboard,
} from "./keyboards.js";
import { notifyStaff } from "./notify.js";
import { clearState, getState, setState } from "./state.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

function stateKey(ctx: BotContext): string {
  return String(ctx.from?.id ?? "unknown");
}

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

  clearState(stateKey(ctx));

  const clients = await listActiveClients();
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

  if (data.startsWith("admin:prank:file:")) {
    await startPrankFile(ctx, data.slice("admin:prank:file:".length));
    return;
  }

  if (data.startsWith("admin:prank:clone:")) {
    await cloneAsPrank(ctx, data.slice("admin:prank:clone:".length));
    return;
  }
}

async function findPrankTarget(rawUserId: string) {
  if (!/^\d{1,19}$/.test(rawUserId)) {
    return null;
  }

  const target = await findUserById(BigInt(rawUserId));
  if (
    !target ||
    target.role !== "client" ||
    target.telegramId < 0n ||
    !target.isActive
  ) {
    return null;
  }

  return target;
}

async function showPrankOrders(
  ctx: BotContext,
  rawUserId: string,
): Promise<void> {
  const target = await findPrankTarget(rawUserId);
  if (!target) {
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

  await editOrReply(
    ctx,
    orders.length === 0
      ? texts.prankNoOrders(displayName(target))
      : texts.prankChooseOrder({
          name: displayName(target),
          room: target.location,
        }),
    prankOrdersKeyboard(orders, target.id.toString()),
  );
}

async function startPrankFile(
  ctx: BotContext,
  rawUserId: string,
): Promise<void> {
  const target = await findPrankTarget(rawUserId);
  if (!target) {
    await editOrReply(ctx, texts.prankUserNotFound, backToMenuKeyboard());
    return;
  }

  setState(stateKey(ctx), {
    step: "prank_file",
    draft: {},
    prankTargetId: target.id.toString(),
  });

  await editOrReply(
    ctx,
    texts.prankAskFile(displayName(target)),
    backToMenuKeyboard(),
  );
}

/** Створення пранк-замовлення зі свого файлу (адмін надсилає документ). */
export async function handlePrankDocument(ctx: BotContext): Promise<void> {
  const key = stateKey(ctx);
  const state = getState(key);
  if (!state || state.step !== "prank_file" || !state.prankTargetId) {
    return;
  }

  if (!isAdmin(ctx)) {
    clearState(key);
    await replyHtml(ctx, texts.adminOnly);
    return;
  }

  const document = ctx.message?.document;
  if (!document) {
    return;
  }

  const inFlightKey = `${ctx.from?.id ?? "0"}:file`;
  if (creating.has(inFlightKey)) {
    return;
  }
  creating.add(inFlightKey);

  try {
    const target = await findPrankTarget(state.prankTargetId);
    if (!target) {
      clearState(key);
      await replyHtml(ctx, texts.prankUserNotFound, backToMenuKeyboard());
      return;
    }

    const room = normalizeRoom(target.location ?? "");
    if (!room) {
      await replyHtml(ctx, texts.prankFailed, backToMenuKeyboard());
      return;
    }

    await ctx.replyWithChatAction("upload_document");

    const bytes = await downloadTelegramFile(
      ctx.api,
      document.file_id,
      document.file_size,
    );
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const parsed = await parseDocument(bytes);

    if (parsed.pages > config.MAX_PAGES_PER_ORDER) {
      await replyHtml(ctx, texts.prankFilePageLimit(config.MAX_PAGES_PER_ORDER));
      return;
    }

    const shadow = await ensureShadowUser(target);
    const markup = markupForClient(target);
    const order = await createOrder({
      clientId: shadow.id,
      files: [
        {
          fileId: document.file_id,
          fileName: document.file_name ?? "файл.pdf",
          mime: document.mime_type ?? "application/octet-stream",
          sizeBytes: document.file_size ?? bytes.length,
          pages: parsed.pages,
          pagesExact: parsed.pagesExact,
          sha256,
        },
      ],
      copies: 1,
      location: room,
      phone: target.phone,
      paymentMethod: "cash",
      pricePerPageKop: pricePerPageWithMarkup(config.PRICE_PER_PAGE_KOP, markup),
    });

    await announcePrankOrder(
      ctx,
      order,
      markup ? markupNote(markup) : undefined,
    );
    clearState(key);
    await replyHtml(ctx, texts.prankCreated(order.code), prankDoneKeyboard());
  } catch (error) {
    if (error instanceof FileTooLargeError) {
      await replyHtml(
        ctx,
        texts.prankFileTooLarge(
          Math.round(config.MAX_FILE_SIZE_BYTES / 1024 / 1024),
        ),
      );
      return;
    }
    if (error instanceof FileParseError) {
      await replyHtml(ctx, texts.prankFileUnsupported(error.message));
      return;
    }
    logger.error(
      { err: error, fileName: document.file_name },
      "prank file order creation failed",
    );
    await replyHtml(ctx, texts.prankFailed, backToMenuKeyboard());
  } finally {
    creating.delete(inFlightKey);
  }
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
    const markup = markupForClient(target);

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
      pricePerPageKop: pricePerPageWithMarkup(config.PRICE_PER_PAGE_KOP, markup),
    });

    await announcePrankOrder(
      ctx,
      order,
      markup ? markupNote(markup) : undefined,
    );

    await editOrReply(
      ctx,
      texts.prankCreated(order.code),
      prankDoneKeyboard(),
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

async function announcePrankOrder(
  ctx: BotContext,
  order: Order,
  note?: string,
): Promise<void> {
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
      markupNote: note,
    }),
  );
}

function prankDoneKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎭 Ще один", "admin:prank")
    .row()
    .text("🏠 Меню", "menu:main");
}
