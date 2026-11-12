import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Готові файли друкарні (рамки/штампи), які лежать в assets/ready-files.
 * Клієнт може додати їх до замовлення без завантаження власного файлу.
 */
export type ReadyFileId = "frame-wide" | "frame-narrow";

export type ReadyFile = {
  id: ReadyFileId;
  label: string;
  fileName: string;
  mime: string;
  pages: number;
  /** Абсолютний шлях до файлу на сервері (потрібен, щоб надіслати працівнику). */
  path: string;
  sizeBytes: number;
  sha256: string;
};

export const READY_FILE_PREFIX = "ready:";

const ASSETS_DIR = fileURLToPath(new URL("../../assets/ready-files/", import.meta.url));

function loadReadyFile(
  id: ReadyFileId,
  label: string,
  fileName: string,
): ReadyFile {
  const path = `${ASSETS_DIR}${fileName}`;

  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    bytes = Buffer.alloc(0);
  }

  return {
    id,
    label,
    fileName,
    mime: "application/msword",
    pages: 1,
    path,
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export const READY_FILES: readonly ReadyFile[] = [
  loadReadyFile("frame-wide", "Широка рамка", "ramka-40.doc"),
  loadReadyFile("frame-narrow", "Вузька рамка", "ramka-15.doc"),
];

export function readyFileTag(id: ReadyFileId): string {
  return `${READY_FILE_PREFIX}${id}`;
}

export function isReadyFileTag(value: string): boolean {
  return value.startsWith(READY_FILE_PREFIX);
}

/** Знаходить готовий файл за значенням, яке зберігається в OrderFile.telegramFileId. */
export function findReadyFileByTag(value: string): ReadyFile | undefined {
  if (!isReadyFileTag(value)) {
    return undefined;
  }
  return findReadyFileById(value.slice(READY_FILE_PREFIX.length));
}

export function findReadyFileById(id: string): ReadyFile | undefined {
  return READY_FILES.find((file) => file.id === id);
}
