import { InlineKeyboard, Keyboard } from "grammy";
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

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
