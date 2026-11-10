import { InlineKeyboard, Keyboard } from "grammy";
import { config } from "../app-config.js";
import { displayName } from "../domain/users.js";
import { isStaff, type Role } from "../domain/roles.js";
import type { User } from "@prisma/client";

export function contactKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("📱 Поділитися номером")
    .oneTime()
    .resized();
}

export function mainMenuKeyboard(role: Role): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (isStaff(role)) {
    keyboard.text("📋 Черга", "menu:queue").row();
  }

  keyboard
    .text("🖨 Нове замовлення", "menu:new")
    .row()
    .text("📄 Мої замовлення", "menu:orders")
    .row()
    .text("👤 Профіль", "menu:profile")
    .text("ℹ️ Допомога", "menu:help");

  if (role === "admin") {
    keyboard.row().text("⚙️ Адмінка", "menu:admin");
  }

  return keyboard;
}

export function confirmProfileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Все вірно", "reg:confirm")
    .text("✏️ Змінити", "reg:restart");
}

export function profileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Ім'я", "profile:name")
    .text("📱 Телефон", "profile:phone")
    .row()
    .text("🚪 Куди нести", "profile:location")
    .row()
    .text("◀️ Назад", "menu:main");
}

export function adminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 Працівники", "admin:workers")
    .row()
    .text("◀️ Назад", "menu:main");
}

export function workersKeyboard(workers: User[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const worker of workers) {
    const name = truncate(displayName(worker), 28);
    const mark = worker.role === "admin" ? "👑" : "👤";
    const id = worker.telegramId.toString();
    keyboard.text(`${mark} ${name}`, `admin:worker:${id}`);

    if (worker.role !== "admin") {
      keyboard.text("🗑", `admin:remove:${id}`);
    }

    keyboard.row();
  }

  keyboard.text("➕ Додати", "admin:add").text("◀️ Назад", "admin:home");
  return keyboard;
}

export function confirmRemoveWorkerKeyboard(telegramId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Так, зняти", `admin:remove_confirm:${telegramId}`)
    .text("Скасувати", "admin:workers");
}

export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("◀️ У меню", "menu:main");
}

export function editProfileKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("◀️ До профілю", "menu:profile");
}

export function orderFilesKeyboard(fileCount: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (fileCount > 0) {
    keyboard.text("✅ Завершити вибір", "order:finish").row();
    keyboard.text("🗑 Прибрати останній", "order:remove").row();
  }

  keyboard.text("◀️ Скасувати", "menu:main");
  return keyboard;
}

export function orderCopiesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("1", "order:copies:1")
    .text("2", "order:copies:2")
    .text("3", "order:copies:3")
    .row()
    .text("5", "order:copies:5")
    .text("10", "order:copies:10")
    .row()
    .text("✏️ Інше", "order:copies_custom")
    .row()
    .text("◀️ До файлів", "order:files_back");
}

export function orderConfirmKeyboard(hasComment: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (config.CARD_TRANSFER_ENABLED) {
    keyboard.text("💳 Переказ на картку", "order:pay:card_transfer").row();
  }

  keyboard.text("💵 Готівка при отриманні", "order:pay:cash").row();
  keyboard
    .text(hasComment ? "✏️ Змінити коментар" : "✏️ Додати коментар", "order:comment")
    .row()
    .text("🔢 Змінити копії", "order:copies_back")
    .row()
    .text("◀️ Скасувати", "menu:main");

  return keyboard;
}

export function orderCreatedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📄 Мої замовлення", "menu:orders")
    .row()
    .text("◀️ Меню", "menu:main");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
