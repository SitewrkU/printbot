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

export async function markCashPaid(
  orderId: bigint,
  actorId: bigint,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new OrderActionError("not_found", "Замовлення не знайдено");
    }
    if (order.paymentStatus === "paid") {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "paid" },
    });

    await tx.payment.create({
      data: {
        orderId,
        provider: "manual",
        status: "paid",
        amountKop: order.amountKop,
        confirmedById: actorId,
      },
    });

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
