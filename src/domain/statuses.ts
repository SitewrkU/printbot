export type OrderStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "READY"
  | "CLOSED"
  | "ON_HOLD"
  | "CANCELLED"
  | "EXPIRED";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "QUEUED",
  "IN_PROGRESS",
  "READY",
  "CLOSED",
  "ON_HOLD",
  "CANCELLED",
  "EXPIRED",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  QUEUED: "у черзі",
  IN_PROGRESS: "друкується",
  READY: "готово до видачі",
  CLOSED: "видано",
  ON_HOLD: "уточнюється",
  CANCELLED: "скасовано",
  EXPIRED: "скасовано (не забрано)",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function statusLabel(status: string): string {
  return isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
}

/** Дозволені переходи. Усе, чого немає в мапі, — заборонено. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  QUEUED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "ON_HOLD", "CANCELLED"],
  READY: ["CLOSED", "EXPIRED", "ON_HOLD"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type PaymentMethod = "cash" | "card_transfer" | "monobank";

export type PaymentStatus = "unpaid" | "pending_review" | "paid" | "refunded";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "не оплачено",
  pending_review: "очікує підтвердження",
  paid: "оплачено",
  refunded: "повернено",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "готівка",
  card_transfer: "переказ на картку",
  monobank: "картка онлайн",
};

export function paymentStatusLabel(status: string): string {
  return status in PAYMENT_STATUS_LABELS
    ? PAYMENT_STATUS_LABELS[status as PaymentStatus]
    : status;
}

export function paymentMethodLabel(method: string): string {
  return method in PAYMENT_METHOD_LABELS
    ? PAYMENT_METHOD_LABELS[method as PaymentMethod]
    : method;
}
