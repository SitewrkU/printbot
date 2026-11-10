import type { Api } from "grammy";
import { config } from "../app-config.js";

export class FileTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Файл більший за ${Math.round(limitBytes / 1024 / 1024)} МБ`);
    this.name = "FileTooLargeError";
  }
}

export async function downloadTelegramFile(
  api: Api,
  fileId: string,
  expectedSize?: number,
): Promise<Uint8Array> {
  if (expectedSize && expectedSize > config.MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(config.MAX_FILE_SIZE_BYTES);
  }

  const file = await api.getFile(fileId);
  if (!file.file_path) {
    throw new Error("Telegram не повернув шлях до файлу");
  }
  if (file.file_size && file.file_size > config.MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(config.MAX_FILE_SIZE_BYTES);
  }

  const url = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити файл (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > config.MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(config.MAX_FILE_SIZE_BYTES);
  }

  return bytes;
}
