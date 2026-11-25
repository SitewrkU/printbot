import type { InlineKeyboard } from "grammy";
import type { BotContext } from "./context.js";
import { config } from "../app-config.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";

/**
 * Повідомлення працівникам: надсилається В ГРУПУ (якщо задано STAFF_CHAT_ID).
 * В особисті повідомлення не дублюється, щоб не забивати приватні чати працівників.
 * Якщо групу не вказано — резервно надсилається в ДМ усім активним працівникам.
 *
 * Повертає true, якщо хоч одне повідомлення вдалося надіслати.
 */
export async function notifyStaff(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<boolean> {
  const options = {
    parse_mode: "HTML" as const,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  };

  if (config.STAFF_CHAT_ID) {
    try {
      await ctx.api.sendMessage(config.STAFF_CHAT_ID, text, options);
      return true;
    } catch (error) {
      logger.warn(
        { err: error, chatId: config.STAFF_CHAT_ID },
        "staff group notification failed",
      );
      return false;
    }
  }

  let sent = false;

  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["worker", "admin"] },
        isActive: true,
      },
      select: { telegramId: true },
    });

    for (const person of staff) {
      try {
        await ctx.api.sendMessage(person.telegramId.toString(), text, options);
        sent = true;
      } catch (error) {
        logger.warn(
          { err: error, telegramId: person.telegramId.toString() },
          "staff DM notification failed",
        );
      }
    }
  } catch (error) {
    logger.warn({ err: error }, "failed to load fallback staff recipients");
  }

  return sent;
}
