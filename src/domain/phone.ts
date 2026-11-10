/**
 * Нормалізує український номер телефону до формату +380XXXXXXXXX.
 * Повертає null, якщо номер невалідний.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s()\-.]/g, "");

  if (!/^\+?\d{9,15}$/.test(cleaned)) {
    return null;
  }

  const digits = cleaned.replace(/^\+/, "");

  if (digits.length === 12 && digits.startsWith("380")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("80")) {
    return `+3${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+38${digits}`;
  }

  return null;
}

/** Для показу: +380 50 123 45 67 */
export function formatPhone(phone: string): string {
  const match = /^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  if (!match) {
    return phone;
  }
  const [, operator = "", part1 = "", part2 = "", part3 = ""] = match;
  return `+380 ${operator} ${part1} ${part2} ${part3}`;
}
