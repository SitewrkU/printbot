import type { Order, Prisma } from "@prisma/client";
import { prisma } from "../infra/db.js";
import { canTransition, isOrderStatus, type OrderStatus } from "./statuses.js";

export class OrderActionError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "bad_status"
      | "invalid_transition"
      | "not_owner",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderActionError";
  }
}

export type OrderView = Prisma.OrderGetPayload<{
  include: { client: true; files: true; acceptedBy: true };
}>;

export async function getOrderView(id: bigint): Promise<OrderView | null> {
  return prisma.order.findUnique({
    where: { id },
    include: { client: true, files: true, acceptedBy: true },
  });
}

export async function listFreeQueue(limit = 8): Promise<Order[]> {
  return prisma.order.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function countFreeQueue(): Promise<number> {
  return prisma.order.count({ where: { status: "QUEUED" } });
}

export async function countWorkerActive(workerId: bigint): Promise<number> {
  return prisma.order.count({
    where: {
      acceptedById: workerId,
      status: { in: ["IN_PROGRESS", "ON_HOLD"] },
    },
  });
}

export async function listWorkerActive(workerId: bigint): Promise<Order[]> {
  return prisma.order.findMany({
    where: {
      status: { in: ["IN_PROGRESS", "ON_HOLD"] },
      acceptedById: workerId,
    },
    orderBy: { acceptedAt: "asc" },
    take: 8,
  });
}

export async function listClientOrders(
  clientId: bigint,
  limit = 10,
): Promise<Order[]> {
  return prisma.order.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type TransitionInput = {
  orderId: bigint;
  to: OrderStatus;
  actorId: bigint | null;
  reason?: string;
  /** Якщо задано — змінювати може лише цей працівник. */
  requireAcceptedBy?: bigint;
};

export async function transitionOrder(input: TransitionInput): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) {
      throw new OrderActionError("not_found", "Замовлення не знайдено");
    }
    if (!isOrderStatus(order.status)) {
      throw new OrderActionError("bad_status", "Невідомий статус замовлення");
    }
    if (!canTransition(order.status, input.to)) {
      throw new OrderActionError(
        "invalid_transition",
        "Цей перехід статусу заборонено",
      );
    }
    if (
      input.requireAcceptedBy !== undefined &&
      order.acceptedById !== input.requireAcceptedBy
    ) {
      throw new OrderActionError("not_owner", "Замовлення взяв інший працівник");
    }

    const data: Prisma.OrderUncheckedUpdateInput = { status: input.to };

    if (input.to === "IN_PROGRESS") {
      data.acceptedById = input.actorId;
      data.acceptedAt = new Date();
      data.holdReason = null;
    }
    if (input.to === "READY") {
      data.readyAt = new Date();
    }
    if (input.to === "CLOSED") {
      data.closedAt = new Date();
    }
    if (input.to === "ON_HOLD") {
      data.holdReason = input.reason ?? null;
    }

    const claimed = await tx.order.updateMany({
      where: { id: input.orderId, status: order.status },
      data,
    });

    if (claimed.count === 0) {
      throw new OrderActionError(
        "invalid_transition",
        "Замовлення вже змінило статус",
      );
    }

    const updated = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
    });

    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorId: input.actorId,
        type: "status_change",
        fromValue: order.status,
        toValue: input.to,
        reason: input.reason ?? null,
      },
    });

    return updated;
  });
}

export async function markPaymentPaid(
  orderId: bigint,
  actorId: bigint,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new OrderActionError("not_found", "Замовлення не знайдено");
    }
    if (
      order.status === "CLOSED" ||
      order.status === "CANCELLED" ||
      order.status === "EXPIRED"
    ) {
      throw new OrderActionError("bad_status", "Замовлення вже завершене");
    }
    if (order.paymentStatus === "paid") {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "paid" },
    });

    const pending = await tx.payment.findFirst({
      where: { orderId, status: "pending_review" },
    });

    if (pending) {
      await tx.payment.update({
        where: { id: pending.id },
        data: {
          status: "paid",
          amountKop: order.amountKop,
          confirmedById: actorId,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId,
          provider: "manual",
          status: "paid",
          amountKop: order.amountKop,
          confirmedById: actorId,
        },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        actorId,
        type: "payment_confirmed",
        fromValue: order.paymentStatus,
        toValue: "paid",
      },
    });

    return updated;
  });
}

export async function changeOrderPrice(input: {
  orderId: bigint;
  amountKop: number;
  reason: string;
  actorId: bigint;
}): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) {
      throw new OrderActionError("not_found", "Замовлення не знайдено");
    }
    if (
      order.status === "READY" ||
      order.status === "CLOSED" ||
      order.status === "CANCELLED" ||
      order.status === "EXPIRED"
    ) {
      throw new OrderActionError("bad_status", "Замовлення вже завершене");
    }
    if (!Number.isInteger(input.amountKop) || input.amountKop <= 0) {
      throw new OrderActionError("bad_status", "Некоректна сума");
    }
    if (input.amountKop === order.amountKop) {
      throw new OrderActionError("bad_status", "Сума не змінилася");
    }

    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: { amountKop: input.amountKop, priceConfirmed: false },
    });

    await tx.payment.updateMany({
      where: { orderId: input.orderId, status: "pending_review" },
      data: { amountKop: input.amountKop },
    });

    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorId: input.actorId,
        type: "price_change",
        fromValue: String(order.amountKop),
        toValue: String(input.amountKop),
        reason: input.reason,
      },
    });

    return updated;
  });
}

export async function confirmOrderPrice(
  orderId: bigint,
  actorId: bigint,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new OrderActionError("not_found", "Замовлення не знайдено");
    }
    if (order.priceConfirmed) {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { priceConfirmed: true },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorId,
        type: "price_confirmed",
        toValue: String(order.amountKop),
      },
    });

    return updated;
  });
}

/** Закриває замовлення, які клієнт не забрав протягом TTL. */
export async function autoCloseReadyOrders(
  now: Date = new Date(),
  ttlHours = 24,
): Promise<number> {
  const cutoff = new Date(now.getTime() - ttlHours * 60 * 60 * 1000);

  const ready = await prisma.order.findMany({
    where: { status: "READY", readyAt: { lt: cutoff } },
    select: { id: true },
  });

  let closed = 0;
  for (const item of ready) {
    try {
      await transitionOrder({
        orderId: item.id,
        to: "CLOSED",
        actorId: null,
        reason: "автоматичне закриття через 24 години",
      });
      closed += 1;
    } catch {
      // Замовлення могло змінитися паралельно — пропускаємо.
    }
  }

  return closed;
}

export type CleanupResult = {
  deleted: number;
  days: number;
};

/**
 * Видаляє старі завершені замовлення, зберігаючи добові агрегати.
 * Прибирає лише метадані — самі файли зберігаються в Telegram.
 */
export async function cleanupOldOrders(
  now: Date = new Date(),
  retentionDays = 90,
): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["CLOSED", "CANCELLED", "EXPIRED"] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      pagesTotal: true,
      amountKop: true,
    },
  });

  if (orders.length === 0) {
    return { deleted: 0, days: retentionDays };
  }

  const byDay = new Map<
    string,
    { orders: number; pages: number; revenueKop: number }
  >();

  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { orders: 0, pages: 0, revenueKop: 0 };
    bucket.orders += 1;
    bucket.pages += order.pagesTotal;
    if (order.status === "CLOSED") {
      bucket.revenueKop += order.amountKop;
    }
    byDay.set(day, bucket);
  }

  for (const [day, bucket] of byDay) {
    const date = new Date(`${day}T00:00:00.000Z`);
    await prisma.dailyStat.upsert({
      where: { day: date },
      create: {
        day: date,
        orders: bucket.orders,
        pages: bucket.pages,
        revenueKop: bucket.revenueKop,
      },
      update: {
        orders: { increment: bucket.orders },
        pages: { increment: bucket.pages },
        revenueKop: { increment: bucket.revenueKop },
      },
    });
  }

  const result = await prisma.order.deleteMany({
    where: { id: { in: orders.map((order) => order.id) } },
  });

  return { deleted: result.count, days: retentionDays };
}
