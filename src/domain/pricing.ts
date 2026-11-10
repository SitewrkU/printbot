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
