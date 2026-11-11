import type { BotContext } from "./context.js";
import { config } from "../app-config.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";

/**
 * Повідомлення працівникам: надсилається В ГРУПУ (якщо задано STAFF_CHAT_ID).
 * В особисті повідомлення не дублюється, щоб не забивати приватні чати працівників.
 * Якщо групу не вказано — резервно надсилається в ДМ усім активним працівникам.
 */
export async function notifyStaff(ctx: BotContext, text: string): Promise<void> {
  if (config.STAFF_CHAT_ID) {
    try {
      await ctx.api.sendMessage(config.STAFF_CHAT_ID, text, { parse_mode: "HTML" });
    } catch (error) {
      logger.warn(
        { err: error, chatId: config.STAFF_CHAT_ID },
        "staff group notification failed",
      );
    }
    return;
  }

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
        await ctx.api.sendMessage(person.telegramId.toString(), text, {
          parse_mode: "HTML",
        });
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
}
