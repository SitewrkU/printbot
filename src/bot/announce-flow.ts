import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";
import { countFreeQueue, countWorkerActive } from "../domain/queue.js";
import { isRole, isStaff, type Role } from "../domain/roles.js";
import {
  getAnnouncement,
  isOrderingEnabled,
  setAnnouncement,
  setOrderingEnabled,
} from "../domain/settings.js";
import { currentUser, type BotContext } from "./context.js";
import { backToMenuKeyboard, staffMenuKeyboard } from "./keyboards.js";
import { clearState, setState } from "./state.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

const BROADCAST_DELAY_MS = 50;

function roleOf(user: { role: string }): Role {
  return isRole(user.role) ? user.role : "client";
}

function stateKey(ctx: BotContext): string {
  return String(ctx.from?.id ?? "unknown");
}

export async function showStaffMenu(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  if (!isStaff(roleOf(user))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const [enabled, announcement, free, mine] = await Promise.all([
    isOrderingEnabled(),
    getAnnouncement(),
    countFreeQueue(),
    countWorkerActive(currentUser(ctx).id),
  ]);

  await editOrReply(
    ctx,
    `${texts.staffMenu}\n\n${texts.orderingStatus(enabled)}\n` +
      `🆓 Вільних: <b>${free}</b> · 🖨 У мене: <b>${mine}</b>` +
      (announcement
        ? `\n\n<b>📢 Останнє оголошення:</b>\n${escapeAnnouncement(announcement)}`
        : ""),
    staffMenuKeyboard(enabled),
  );
}

export async function startAnnouncement(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  if (!isStaff(roleOf(user))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  setState(stateKey(ctx), { step: "staff_announce", draft: {} });
  await editOrReply(ctx, texts.announcementPrompt, backToMenuKeyboard());
}

export async function handleAnnouncementText(
  ctx: BotContext,
  text: string,
): Promise<void> {
  const user = currentUser(ctx);
  const key = stateKey(ctx);

  if (!isStaff(roleOf(user))) {
    clearState(key);
    await replyHtml(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const message = text.trim();
  if (message.length < 3) {
    await ctx.reply(texts.announcementTooShort, { parse_mode: "HTML" });
    return;
  }
  if (message.length > 2000) {
    await ctx.reply(texts.announcementTooLong, { parse_mode: "HTML" });
    return;
  }

  clearState(key);
  await setAnnouncement(message);

  const result = await broadcast(ctx, message);
  await ctx.reply(texts.announcementSent(result), { parse_mode: "HTML" });
  await showStaffMenu(ctx);
}

export async function toggleOrdering(ctx: BotContext): Promise<void> {
  const enabled = await isOrderingEnabled();
  await setOrdering(ctx, !enabled);
}

export async function setOrdering(
  ctx: BotContext,
  enabled: boolean,
): Promise<void> {
  const user = currentUser(ctx);
  if (!isStaff(roleOf(user))) {
    await editOrReply(ctx, texts.adminOnly, backToMenuKeyboard());
    return;
  }

  const current = await isOrderingEnabled();
  if (current !== enabled) {
    await setOrderingEnabled(enabled);
  }

  await ctx.reply(
    enabled ? texts.orderingEnabledMessage : texts.orderingDisabledMessage,
    { parse_mode: "HTML" },
  );
  await showStaffMenu(ctx);
}

export async function handleStaffCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  if (data === "staff:home") {
    await showStaffMenu(ctx);
    return;
  }
  if (data === "staff:announce") {
    await startAnnouncement(ctx);
    return;
  }
  if (data === "staff:toggle") {
    await toggleOrdering(ctx);
    return;
  }
  if (data === "staff:ordering:on" || data === "staff:ordering:off") {
    await setOrdering(ctx, data === "staff:ordering:on");
    return;
  }
  await replyHtml(ctx, texts.orderActionNotAllowed);
}

async function broadcast(
  ctx: BotContext,
  message: string,
): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, telegramId: true },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await ctx.api.sendMessage(user.telegramId.toString(), message);
      sent += 1;
    } catch (error) {
      failed += 1;
      const code = (error as { error_code?: number } | null)?.error_code;
      if (code === 403) {
        await prisma.user
          .update({ where: { id: user.id }, data: { isActive: false } })
          .catch(() => undefined);
      }
      logger.warn(
        { err: error, telegramId: user.telegramId.toString() },
        "announcement delivery failed",
      );
    }
    await delay(BROADCAST_DELAY_MS);
  }

  return { sent, failed };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeAnnouncement(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
