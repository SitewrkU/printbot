/**
 * Кімната гуртожитку: 1–2 цифри + «б» (бічна) або «п» (пряма).
 * Приклади: 25б, 7п, 48Б.
 */
export function normalizeRoom(value: string): string | null {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/b/g, "б")
    .replace(/p/g, "п");

  const match = /^(\d{1,2})([бп])$/.exec(cleaned);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  if (number < 1) {
    return null;
  }

  return `${number}${match[2]}`;
}

export function isValidRoom(value: string | null | undefined): boolean {
  return Boolean(value && normalizeRoom(value));
}
