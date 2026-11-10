export type Role = "client" | "worker" | "admin";

export const ROLES: readonly Role[] = ["client", "worker", "admin"];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Роль, яку система гарантує для цього Telegram ID.
 * Адміни задаються тільки через конфіг, роль працівника — тільки в БД.
 */
export function resolveRole(telegramId: string, adminIds: readonly string[]): Role {
  return adminIds.includes(telegramId) ? "admin" : "client";
}

export function isStaff(role: Role): boolean {
  return role === "worker" || role === "admin";
}

export function canManageWorkers(role: Role): boolean {
  return role === "admin";
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "адміністратор";
    case "worker":
      return "працівник";
    default:
      return "клієнт";
  }
}
