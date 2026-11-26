/**
 * Персональні націнки до базової ціни.
 *
 * Ключ — Telegram ID клієнта. Для тіньових копій (пранк-замовлення) працює
 * додатково збіг за іменем, щоб такі замовлення виглядали однаково.
 */
export type ClientMarkup = {
  percent: number;
  name: string;
};

const MARKUPS_BY_TELEGRAM_ID: Record<string, ClientMarkup> = {
  // Оксана Левицька (реальний акаунт)
  "6687170291": { percent: 50, name: "Оксана" },
  // Її тіньова копія для пранк-замовлень
  "-1000000000000012": { percent: 50, name: "Оксана" },
};

const MARKUPS_BY_NAME: Array<{ fullName: string; markup: ClientMarkup }> = [
  { fullName: "оксана левицька", markup: { percent: 50, name: "Оксана" } },
];

function normalizeName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function markupForClient(client: {
  telegramId: bigint;
  fullName?: string | null;
}): ClientMarkup | null {
  const byId = MARKUPS_BY_TELEGRAM_ID[client.telegramId.toString()];
  if (byId) {
    return byId;
  }

  const name = normalizeName(client.fullName);
  if (!name) {
    return null;
  }

  return MARKUPS_BY_NAME.find((entry) => entry.fullName === name)?.markup ?? null;
}

/** Ціна за сторінку з урахуванням націнки. */
export function pricePerPageWithMarkup(
  basePricePerPageKop: number,
  markup: ClientMarkup | null,
): number {
  if (!markup) {
    return basePricePerPageKop;
  }
  return Math.round((basePricePerPageKop * (100 + markup.percent)) / 100);
}

/** Готова сума з націнкою. */
export function applyMarkupKop(
  amountKop: number,
  markup: ClientMarkup,
): number {
  return Math.round((amountKop * (100 + markup.percent)) / 100);
}

/**
 * Чи справді в цьому замовленні застосована націнка.
 * Перевіряємо за сумою, щоб старі замовлення не показували зайвий підпис.
 */
export function orderHasMarkup(
  order: { pagesTotal: number; copies: number; amountKop: number },
  markup: ClientMarkup,
  basePricePerPageKop: number,
): boolean {
  const baseAmountKop = order.pagesTotal * order.copies * basePricePerPageKop;
  return order.amountKop === applyMarkupKop(baseAmountKop, markup);
}

/** Пояснення в дужках для повідомлень. */
export function markupNote(markup: ClientMarkup): string {
  return `(ціна на ${markup.percent}% більша, бо вона ${markup.name})`;
}
