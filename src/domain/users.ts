import type { User } from "@prisma/client";
import { prisma } from "../infra/db.js";
import { ROLES, resolveRole, type Role } from "./roles.js";

export async function findUser(telegramId: bigint): Promise<User | null> {
  return prisma.user.findUnique({ where: { telegramId } });
}

/**
 * Гарантує, що користувач існує, і синхронізує роль адміністратора з конфігом.
 * Роль працівника з БД не перетирається.
 */
export async function ensureUser(
  telegramId: bigint,
  adminIds: readonly string[],
): Promise<User> {
  const expectedRole = resolveRole(telegramId.toString(), adminIds);
  const existing = await findUser(telegramId);

  if (!existing) {
    return prisma.user.create({
      data: { telegramId, role: expectedRole },
    });
  }

  if (expectedRole === "admin" && existing.role !== "admin") {
    return prisma.user.update({
      where: { id: existing.id },
      data: { role: "admin" },
    });
  }

  return existing;
}

export async function saveProfile(
  userId: bigint,
  data: { fullName?: string; phone?: string; location?: string },
): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data });
}

export function isRoleName(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function addWorker(telegramId: bigint): Promise<User> {
  return prisma.user.upsert({
    where: { telegramId },
    create: { telegramId, role: "worker" },
    update: { role: "worker", isActive: true },
  });
}

export async function removeWorker(telegramId: bigint): Promise<User> {
  return prisma.user.update({
    where: { telegramId },
    data: { role: "client" },
  });
}

export async function listWorkers(): Promise<User[]> {
  return prisma.user.findMany({
    where: { role: { in: ["worker", "admin"] }, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function blockUser(
  userId: bigint,
  reason: string,
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { isBlocked: true, blockedReason: reason, blockedAt: new Date() },
  });
}

export async function unblockUser(userId: bigint): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { isBlocked: false, blockedReason: null, blockedAt: null },
  });
}

export async function listBlockedUsers(): Promise<User[]> {
  return prisma.user.findMany({
    where: { isBlocked: true },
    orderBy: { blockedAt: "desc" },
  });
}

export function displayName(user: User): string {
  return user.fullName?.trim() || `ID ${user.telegramId.toString()}`;
}
