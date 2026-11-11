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
    keyboard.text("📢 Оголошення", "staff:home").row();
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
    .text("🚪 Кімната", "profile:location")
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

export function roomRequiredKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🚪 Вказати кімнату", "profile:location")
    .row()
    .text("◀️ У меню", "menu:main");
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

export function cashConfirmKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Так, отримав", `q:cash:${orderId}`)
    .text("Пізніше", `q:view:${orderId}`);
}

export function orderDetailKeyboard(params: {
  orderId: string;
  code: string;
  isStaff: boolean;
  isMine: boolean;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  priceConfirmed: boolean;
  clientRole: string;
  clientBlocked: boolean;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const id = params.orderId;
  const canReview = ["QUEUED", "IN_PROGRESS", "ON_HOLD"].includes(params.status);

  if (params.isStaff && params.status === "QUEUED") {
    keyboard.text("✅ Взяти в роботу", `q:take:${id}`).row();
  }

  if (params.isStaff && params.status === "IN_PROGRESS" && params.isMine) {
    if (params.priceConfirmed) {
      keyboard.text("✅ Готово", `q:ready:${id}`).row();
    }
    keyboard.text("⚠️ Проблема", `q:hold:${id}`).row();
  }

  if (params.isStaff && params.status === "ON_HOLD" && params.isMine) {
    keyboard.text("▶️ Продовжити", `q:resume:${id}`).row();
  }

  if (params.isStaff && canReview) {
    keyboard.text("💰 Змінити ціну", `q:price:${id}`).row();
    keyboard.text("❌ Відхилити", `q:reject:${id}`).row();
  }

  if (params.isStaff && params.clientRole === "client" && canReview) {
    if (params.clientBlocked) {
      keyboard.text("✅ Розблокувати клієнта", `q:unblock:${id}`).row();
    } else {
      keyboard.text("🚫 Заблокувати клієнта", `q:block:${id}`).row();
    }
  }

  if (
    params.isStaff &&
    params.status === "READY" &&
    params.paymentMethod === "cash" &&
    params.paymentStatus !== "paid"
  ) {
    keyboard.text("💵 Гроші отримано", `q:cash:${id}`).row();
  }

  if (
    params.isStaff &&
    params.paymentStatus === "pending_review" &&
    (canReview || params.status === "READY")
  ) {
    keyboard.text("💰 Оплату підтверджено", `q:paid:${id}`).row();
  }

  if (!params.isStaff && !params.priceConfirmed && canReview) {
    keyboard.text("✅ Погоджуюсь із ціною", `o:agree:${id}`).row();
    keyboard.text("❌ Відмовитись", `o:decline:${id}`).row();
  }

  if (!params.isStaff && params.status === "QUEUED" && params.priceConfirmed) {
    keyboard.text("❌ Скасувати замовлення", `o:cancel:${id}`).row();
  }

  if (
    !params.isStaff &&
    params.paymentMethod === "card_transfer" &&
    params.paymentStatus !== "paid" &&
    canReview
  ) {
    keyboard.text("✅ Я оплатив", `o:paid:${id}`).row();
  }

  if (!params.isStaff && params.status === "READY") {
    keyboard.text("✅ Забрав", `o:close:${id}`).row();
  }

  if (params.isStaff) {
    keyboard.text("📎 Надіслати файли", `q:files:${id}`);
  }

  keyboard.text("◀️ Назад", params.isStaff ? "menu:queue" : "menu:orders");
  return keyboard;
}

export function rejectReasonsKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎨 Багато кольору", `q:rejectr:${orderId}:color`)
    .row()
    .text("📄 Файл нечитабельний", `q:rejectr:${orderId}:file`)
    .row()
    .text("◀️ Назад", `q:view:${orderId}`);
}

export function clientPriceKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Погоджуюсь", `o:agree:${orderId}`)
    .text("❌ Відмовитись", `o:decline:${orderId}`);
}

export function staffMenuKeyboard(orderingEnabled: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text("📢 Надіслати оголошення", "staff:announce")
    .row()
    .text("🚫 Заблоковані клієнти", "staff:blocked")
    .row()
    .text(
      orderingEnabled ? "⏸ Вимкнути замовлення" : "▶️ Увімкнути замовлення",
      orderingEnabled ? "staff:ordering:off" : "staff:ordering:on",
    )
    .row()
    .text("◀️ Меню", "menu:main");
}

export function blockReasonKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("◀️ Скасувати", `q:view:${orderId}`)
    .row()
    .text("🏠 У меню", "menu:main");
}

export function blockedUsersKeyboard(users: User[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const user of users) {
    keyboard
      .text(`✅ ${truncate(displayName(user), 28)}`, `staff:ublock:${user.id}`)
      .row();
  }

  keyboard.text("◀️ Службове меню", "staff:home").text("🏠 Меню", "menu:main");
  return keyboard;
}

export function holdReasonsKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("📄 Файл не читається", `q:holdr:${orderId}:broken`)
    .row()
    .text("🧻 Немає паперу", `q:holdr:${orderId}:paper`)
    .row()
    .text("📵 Клієнт не відповідає", `q:holdr:${orderId}:client`)
    .row()
    .text("◀️ Назад", `q:view:${orderId}`);
}

export function clientOrdersKeyboard(
  orders: ReadonlyArray<{ id: string; code: string; status: string }>,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const order of orders) {
    keyboard.text(order.code, `o:view:${order.id}`).row();
  }

  keyboard.text("◀️ Меню", "menu:main");
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
