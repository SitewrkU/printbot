import { config } from "../app-config.js";
import { formatUah } from "../domain/pricing.js";
import { formatPhone } from "../domain/phone.js";
import { roleLabel, type Role } from "../domain/roles.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const limits = () =>
  `Один файл — до 20 МБ, до ${config.MAX_FILES_PER_ORDER} файлів і ${config.MAX_PAGES_PER_ORDER} сторінок у замовленні.`;

const price = () => `${formatUah(config.PRICE_PER_PAGE_KOP)} за сторінку A4`;

export const texts = {
  welcome: (name?: string) =>
    `👋 <b>Вітаємо${name ? `, ${escapeHtml(name)}` : ""}!</b>\n\n` +
    `Це бот друкарні «${escapeHtml(config.PRINT_NAME)}».\n` +
    `Надсилаєте файл → бачите ціну → забираєте роздруківку.\n\n` +
    `<b>${price()}</b>, чорно-білий друк.\n` +
    `Графік: ${escapeHtml(config.WORK_HOURS)}`,

  askName: `Як вас звати? Напишіть ім'я та прізвище одним повідомленням.`,
  invalidName: `Ім'я має містити від 2 до 60 символів. Спробуйте ще раз.`,

  askPhone:
    `Надішліть номер телефону:\n` +
    `• кнопкою нижче, або\n` +
    `• вручну у форматі <code>+380501234567</code>`,
  invalidPhone: `Не вдалося розпізнати номер. Формат: <code>+380501234567</code>.`,

  askLocation: `Вкажіть, куди принести роздруківку: корпус і кімната (наприклад, <code>4 корпус, 415</code>).`,
  invalidLocation: `Локація має містити від 1 до 32 символів.`,

  confirmProfile: (data: { fullName?: string; phone?: string; location?: string }) =>
    `<b>Перевірте дані</b>\n\n` +
    `Ім'я: ${escapeHtml(data.fullName ?? "—")}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}\n` +
    `Куди нести: ${escapeHtml(data.location ?? "—")}`,

  profileSaved: `✅ Дані збережено — наступного разу вводити не потрібно.`,

  mainMenu: (name?: string) =>
    `${name ? `Привіт, ${escapeHtml(name)}! 👋` : "Головне меню"}\n\n` +
    `Що робимо?`,

  profile: (data: {
    fullName?: string | null;
    phone?: string | null;
    location?: string | null;
    role: Role;
  }) =>
    `<b>Мій профіль</b>\n\n` +
    `Ім'я: ${escapeHtml(data.fullName ?? "—")}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}\n` +
    `Куди нести: ${escapeHtml(data.location ?? "—")}\n` +
    `Роль: ${roleLabel(data.role)}`,

  help:
    `<b>Як це працює</b>\n\n` +
    `1. Оформлюєте замовлення й надсилаєте файли PDF або DOCX.\n` +
    `2. Бот рахує сторінки й показує ціну: ${price()}.\n` +
    `3. Обираєте оплату: переказ на картку або готівкою при отриманні.\n` +
    `4. Працівник друкує, бот пише, коли можна забирати.\n\n` +
    `<b>Ліміти:</b> ${limits()}\n` +
    `<b>Графік:</b> ${escapeHtml(config.WORK_HOURS)}\n` +
    (config.SUPPORT_CONTACT
      ? `<b>Підтримка:</b> ${escapeHtml(config.SUPPORT_CONTACT)}`
      : ""),

  ordersEmpty: `У вас ще немає замовлень. Натисніть «🖨 Нове замовлення», щоб створити перше.`,

  queueEmpty: `Зараз вільних замовлень немає.`,

  newOrderSoon:
    `🖨 Прийом файлів з'явиться на наступному етапі (E1).\n` +
    `Поки що можна переглянути профіль і допомогу.`,

  queueSoon:
    `📋 Черга з'явиться на етапі E2.\n` +
    `Поки що тут нічого немає.`,

  adminHome: `<b>⚙️ Адмінка</b>\n\nКерування працівниками та службові дії.`,
  adminWorkers: (count: number) =>
    `<b>👥 Працівники</b>\n\nАктивних: ${count}.\n` +
    `Щоб додати людину, натисніть «➕ Додати» і надішліть її Telegram ID.\n` +
    `Людина має хоча б раз натиснути /start.`,
  adminAskWorkerId:
    `Надішліть Telegram ID нового працівника (лише цифри).\n\n` +
    `Підказка: людина може дізнатися свій ID через бота @userinfobot.`,
  adminWorkerAdded: (id: string) =>
    `✅ <b>${id}</b> тепер працівник. Нехай натисне /start, якщо ще не робив цього.`,
  adminWorkerRemoved: (id: string) => `✅ <b>${id}</b> більше не працівник.`,
  adminConfirmRemove: (name: string) =>
    `Зняти роль працівника з <b>${escapeHtml(name)}</b>?`,
  adminWorkerNotFound: `Користувача з таким ID не знайдено в базі.`,
  adminCannotRemoveAdmin: `Не можна зняти роль з адміністратора.`,
  adminInvalidId: `ID має складатися з 5–15 цифр. Спробуйте ще раз.`,
  adminOnly: `Ця дія доступна лише адміністратору.`,

  orderLine: (order: {
    code: string;
    status: string;
    amount: string;
    pages: number;
    copies: number;
  }) =>
    `<b>${escapeHtml(order.code)}</b> — ${order.status}\n` +
    `${order.pages} стор. × ${order.copies} = ${order.amount}`,

  cancelDone: `Дію скасовано.`,
  fallback: `Скористайтеся меню нижче або натисніть /start.`,
  unknownMessage: `Надішліть текст або скористайтеся кнопками меню.`,
  profileUpdated: `✅ Оновлено.`,
  roleLine: (role: Role) => `Ваша роль: <b>${roleLabel(role)}</b>`,
};
