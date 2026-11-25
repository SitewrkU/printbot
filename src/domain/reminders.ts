import { prisma } from "../infra/db.js";

/** Не частіше одного нагадування на клієнта за 30 хвилин. */
export const REMINDER_COOLDOWN_MS = 30 * 60 * 1000;

export const REMINDABLE_STATUSES = ["QUEUED", "IN_PROGRESS", "ON_HOLD"] as const;
export type RemindableStatus = (typeof REMINDABLE_STATUSES)[number];

export function isRemindableStatus(status: string): status is RemindableStatus {
  return (REMINDABLE_STATUSES as readonly string[]).includes(status);
}

/** Скільки ще чекати до наступного нагадування (0 — можна). */
export function remainingCooldownMs(
  lastReminderAt: Date | null,
  now: Date = new Date(),
): number {
  if (!lastReminderAt) {
    return 0;
  }
  return Math.max(0, REMINDER_COOLDOWN_MS - (now.getTime() - lastReminderAt.getTime()));
}

export function minutesLeft(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

export async function lastClientReminderAt(
  clientId: bigint,
): Promise<Date | null> {
  const event = await prisma.orderEvent.findFirst({
    where: { actorId: clientId, type: "client_reminder" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return event?.createdAt ?? null;
}

export async function lastStatusChangeAt(
  orderId: bigint,
  fallback: Date,
): Promise<Date> {
  const event = await prisma.orderEvent.findFirst({
    where: {
      orderId,
      type: { in: ["order_created", "status_change"] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return event?.createdAt ?? fallback;
}

export async function recordReminder(
  orderId: bigint,
  clientId: bigint,
  code: string,
): Promise<void> {
  await prisma.orderEvent.create({
    data: {
      orderId,
      actorId: clientId,
      type: "client_reminder",
      payload: { code },
    },
  });
}
