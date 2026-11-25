import { InlineKeyboard, type Api } from "grammy";
import {
  listReminderPromptCandidates,
  recordReminderPrompt,
} from "../domain/reminders.js";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";
import { texts } from "./texts.js";

const inFlight = new Set<string>();

function formatWaiting(since: Date, now: Date): string {
  const minutes = Math.max(
    1,
    Math.floor((now.getTime() - since.getTime()) / 60_000),
  );
  if (minutes < 60) {
    return `${minutes} хв`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} год`;
}

/**
 * Раз на кілька хвилин перевіряє замовлення, які «провисіли» без зміни
 * статусу, і м'яко пропонує клієнту нагадати про них працівникам.
 * Кожна пропозиція надсилається не більше одного разу на статус.
 */
export async function sendReminderPrompts(
  api: Api,
  now: Date = new Date(),
): Promise<number> {
  const candidates = await listReminderPromptCandidates(now);
  let sent = 0;

  for (const candidate of candidates) {
    const key = candidate.orderId.toString();
    if (inFlight.has(key)) {
      continue;
    }
    inFlight.add(key);

    try {
      await api.sendMessage(
        candidate.telegramId.toString(),
        texts.reminderNudge({
          code: candidate.code,
          waiting: formatWaiting(candidate.lastChangeAt, now),
        }),
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text("🔔 Нагадати про замовлення", `o:remind:${key}`)
            .row()
            .text("📄 Відкрити замовлення", `o:view:${key}`),
        },
      );
      await recordReminderPrompt(candidate.orderId, candidate.code);
      sent += 1;
    } catch (error) {
      const code = (error as { error_code?: number } | null)?.error_code;
      if (code === 403) {
        await prisma.user
          .update({
            where: { telegramId: candidate.telegramId },
            data: { isActive: false },
          })
          .catch(() => undefined);
      }
      logger.warn(
        {
          err: error,
          orderId: key,
          telegramId: candidate.telegramId.toString(),
        },
        "reminder nudge failed",
      );
    } finally {
      inFlight.delete(key);
    }
  }

  return sent;
}
