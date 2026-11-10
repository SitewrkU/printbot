import { prisma } from "../infra/db.js";

export const SETTING_ORDERING_ENABLED = "ordering_enabled";
export const SETTING_ANNOUNCEMENT = "announcement";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function isOrderingEnabled(): Promise<boolean> {
  return (await getSetting(SETTING_ORDERING_ENABLED)) !== "false";
}

export async function setOrderingEnabled(enabled: boolean): Promise<void> {
  await setSetting(SETTING_ORDERING_ENABLED, enabled ? "true" : "false");
}

export async function getAnnouncement(): Promise<string | null> {
  const value = await getSetting(SETTING_ANNOUNCEMENT);
  return value && value.length > 0 ? value : null;
}

export async function setAnnouncement(text: string): Promise<void> {
  await setSetting(SETTING_ANNOUNCEMENT, text);
}
