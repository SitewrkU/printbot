import { logger } from "../infra/logger.js";
import { isRole, isStaff, type Role } from "../domain/roles.js";
import { displayName, listBlockedUsers, unblockUser } from "../domain/users.js";
import { currentUser, type BotContext } from "./context.js";
import { blockedUsersKeyboard } from "./keyboards.js";
import { texts } from "./texts.js";
import { editOrReply, replyHtml } from "./utils.js";

function roleOf(user: { role: string }): Role {
  return isRole(user.role) ? user.role : "client";
}

export async function showBlockedUsers(ctx: BotContext): Promise<void> {
  const user = currentUser(ctx);
  if (!isStaff(roleOf(user))) {
    await replyHtml(ctx, texts.adminOnly);
    return;
  }

  const blocked = await listBlockedUsers();
  if (blocked.length === 0) {
    await editOrReply(ctx, texts.blockedListEmpty, blockedUsersKeyboard([]));
    return;
  }

  const body = blocked
    .map((person) =>
      texts.blockedUserLine({
        name: displayName(person),
        room: person.location,
        reason: person.blockedReason,
        blockedAt: person.blockedAt,
      }),
    )
    .join("\n\n");

  await editOrReply(
    ctx,
    `${texts.blockedListHeader(blocked.length)}\n\n${body}`,
    blockedUsersKeyboard(blocked),
  );
}

export async function handleBlockedCallback(
  ctx: BotContext,
  data: string,
): Promise<void> {
  const user = currentUser(ctx);
  if (!isStaff(roleOf(user))) {
    await replyHtml(ctx, texts.adminOnly);
    return;
  }

  if (data === "staff:blocked") {
    await showBlockedUsers(ctx);
    return;
  }

  const rawId = data.slice("staff:ublock:".length);
  if (!/^\d{1,15}$/.test(rawId)) {
    await replyHtml(ctx, texts.orderActionNotAllowed);
    return;
  }

  try {
    const updated = await unblockUser(BigInt(rawId));
    await ctx.reply(texts.unblockedDone(displayName(updated)), {
      parse_mode: "HTML",
    });
    try {
      await ctx.api.sendMessage(updated.telegramId.toString(), texts.unblockedClient, {
        parse_mode: "HTML",
      });
    } catch (error) {
      logger.warn(
        { err: error, telegramId: updated.telegramId.toString() },
        "unblock notification failed",
      );
    }
    await showBlockedUsers(ctx);
  } catch (error) {
    logger.error({ err: error, userId: rawId }, "unblock failed");
    await replyHtml(ctx, texts.orderActionNotAllowed);
  }
}
