import type { BotContext } from "./context.js";
import { config } from "../app-config.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";

/**
 * Нове замовлення / подія для працівників: група (якщо задана) + особисті
 * повідомлення всім активним працівникам і адмінам.
 */
export async function notifyStaff(ctx: BotContext, text: string): Promise<void> {
  const targets = new Set<string>();

  if (config.STAFF_CHAT_ID) {
    targets.add(config.STAFF_CHAT_ID);
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
      targets.add(person.telegramId.toString());
    }
  } catch (error) {
    logger.warn({ err: error }, "failed to load staff recipients");
  }

  for (const chatId of targets) {
    try {
      await ctx.api.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (error) {
      logger.warn({ err: error, chatId }, "staff notification failed");
    }
  }
}
