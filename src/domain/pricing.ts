/**
 * Ціна замовлення: сторінки × копії × ціна за сторінку.
 * Рахується ТІЛЬКИ на сервері; клієнт не передає ні сторінки, ні суму.
 */
export function calcAmountKop(
  pages: number,
  copies: number,
  pricePerPageKop: number,
): number {
  assertPositiveInt(pages, "pages");
  assertPositiveInt(copies, "copies");
  assertPositiveInt(pricePerPageKop, "pricePerPageKop");

  return pages * copies * pricePerPageKop;
}

function assertPositiveInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} має бути додатним цілим числом`);
  }
}

/** 7200 -> "72,00 грн" */
export function formatUah(amountKop: number): string {
  if (!Number.isSafeInteger(amountKop) || amountKop < 0) {
    throw new RangeError("amountKop має бути невід'ємним цілим числом");
  }
  const hryvnia = Math.floor(amountKop / 100);
  const kopiykas = String(amountKop % 100).padStart(2, "0");
  return `${hryvnia},${kopiykas} грн`;
}

export type PriceInput = {
  amountKop: number;
  reason: string;
};

const PRICE_REASON_DEFAULT = "багато кольору / заливки";
export const MAX_MANUAL_PRICE_KOP = 100_000; // 1000 грн на одне замовлення

/** "45 | багато чорного" -> { amountKop: 4500, reason: "багато чорного" } */
export function parsePriceInput(raw: string): PriceInput | null {
  const [amountPart, ...reasonParts] = raw.split("|");
  const amountText = (amountPart ?? "").trim().replace(/\s|грн/gi, "").replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(amountText)) {
    return null;
  }

  const amountKop = Math.round(Number(amountText) * 100);
  if (amountKop <= 0 || amountKop > MAX_MANUAL_PRICE_KOP) {
    return null;
  }

  const reason = reasonParts.join("|").trim().slice(0, 200);
  return { amountKop, reason: reason.length > 0 ? reason : PRICE_REASON_DEFAULT };
}
