/** Причина блокування: 3–200 символів, зайві пробіли згортаються. */
export function normalizeBlockReason(raw: string): string | null {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (reason.length < 3 || reason.length > 200) {
    return null;
  }
  return reason;
}
