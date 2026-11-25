import { prisma } from "../infra/db.js";

/** Не частіше одного нагадування на клієнта за 30 хвилин. */
export const REMINDER_COOLDOWN_MS = 30 * 60 * 1000;

/** Через скільки хвилин без змін бот сам пропонує нагадати про замовлення. */
export const REMINDER_PROMPT_AFTER_MS = 30 * 60 * 1000;

/** Подія, якою позначаємо, що автоматична пропозиція вже надіслана. */
export const REMINDER_PROMPT_EVENT = "reminder_prompt";

export const REMINDABLE_STATUSES = ["QUEUED", "IN_PROGRESS", "ON_HOLD"] as const;
export type RemindableStatus = (typeof REMINDABLE_STATUSES)[number];

export function isRemindableStatus(status: string): status is RemindableStatus {
  return (REMINDABLE_STATUSES as readonly string[]).includes(status);
}

export type ReminderEvent = { type: string; createdAt: Date };

/** Час останньої зміни статусу замовлення (або створення, якщо змін не було). */
export function lastStatusChangeFromEvents(
  createdAt: Date,
  events: readonly ReminderEvent[],
): Date {
  let last = createdAt;

  for (const event of events) {
    if (
      (event.type === "order_created" || event.type === "status_change") &&
      event.createdAt.getTime() > last.getTime()
    ) {
      last = event.createdAt;
    }
  }

  return last;
}

/**
 * Чи варто запропонувати клієнту нагадати про замовлення:
 * статус не змінювався 30 хв, клієнт ще не нагадував і пропозиції не було.
 */
export function shouldPromptReminder(params: {
  createdAt: Date;
  events: readonly ReminderEvent[];
  now?: Date;
}): { prompt: boolean; lastChangeAt: Date } {
  const now = params.now ?? new Date();
  const lastChangeAt = lastStatusChangeFromEvents(params.createdAt, params.events);
  const idleMs = now.getTime() - lastChangeAt.getTime();
  const alreadyActed = params.events.some(
    (event) =>
      (event.type === "client_reminder" || event.type === REMINDER_PROMPT_EVENT) &&
      event.createdAt.getTime() >= lastChangeAt.getTime(),
  );

  return {
    prompt: idleMs >= REMINDER_PROMPT_AFTER_MS && !alreadyActed,
    lastChangeAt,
  };
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

export async function recordReminderPrompt(
  orderId: bigint,
  code: string,
): Promise<void> {
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: REMINDER_PROMPT_EVENT,
      payload: { code },
    },
  });
}

export type ReminderPromptCandidate = {
  orderId: bigint;
  code: string;
  status: RemindableStatus;
  pagesTotal: number;
  copies: number;
  amountKop: number;
  telegramId: bigint;
  lastChangeAt: Date;
};

/**
 * Замовлення, які «провисіли» 30 хв без зміни статусу і про які ще не
 * нагадували ані клієнт, ані бот. Тіньові (пранк) і заблоковані клієнти
 * сюди не потрапляють.
 */
export async function listReminderPromptCandidates(
  now: Date = new Date(),
): Promise<ReminderPromptCandidate[]> {
  const cutoff = new Date(now.getTime() - REMINDER_PROMPT_AFTER_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...REMINDABLE_STATUSES] },
      priceConfirmed: true,
      createdAt: { lte: cutoff },
      client: {
        telegramId: { gt: 0n },
        isActive: true,
        isBlocked: false,
      },
    },
    select: {
      id: true,
      code: true,
      status: true,
      pagesTotal: true,
      copies: true,
      amountKop: true,
      createdAt: true,
      client: { select: { telegramId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  if (orders.length === 0) {
    return [];
  }

  const events = await prisma.orderEvent.findMany({
    where: {
      orderId: { in: orders.map((order) => order.id) },
      type: {
        in: ["order_created", "status_change", "client_reminder", REMINDER_PROMPT_EVENT],
      },
    },
    select: { orderId: true, type: true, createdAt: true },
  });

  const eventsByOrder = new Map<string, ReminderEvent[]>();
  for (const event of events) {
    const key = event.orderId.toString();
    const list = eventsByOrder.get(key);
    if (list) {
      list.push(event);
    } else {
      eventsByOrder.set(key, [event]);
    }
  }

  const candidates: ReminderPromptCandidate[] = [];

  for (const order of orders) {
    if (!isRemindableStatus(order.status)) {
      continue;
    }

    const { prompt, lastChangeAt } = shouldPromptReminder({
      createdAt: order.createdAt,
      events: eventsByOrder.get(order.id.toString()) ?? [],
      now,
    });

    if (!prompt) {
      continue;
    }

    candidates.push({
      orderId: order.id,
      code: order.code,
      status: order.status,
      pagesTotal: order.pagesTotal,
      copies: order.copies,
      amountKop: order.amountKop,
      telegramId: order.client.telegramId,
      lastChangeAt,
    });
  }

  return candidates;
}
