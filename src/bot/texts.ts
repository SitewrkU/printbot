import { config } from "../app-config.js";
import { formatUah } from "../domain/pricing.js";
import { formatPhone } from "../domain/phone.js";
import { roleLabel, type Role } from "../domain/roles.js";

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(date);
}

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

  // --------------------------------------------------------------- замовлення

  orderRules:
    `<b>🖨 Нове замовлення</b>\n\n` +
    `Надішліть файли як <b>документи</b> (скріпка → «Файл»), не як фото.\n` +
    `Формати: PDF, DOCX.\n\n` +
    `<b>Ліміти:</b> ${limits()}\n` +
    `<b>Ціна:</b> ${price()}.\n\n` +
    `Після кожного файлу покажу кількість сторінок. Коли все надіслано — натисніть «✅ Завершити вибір».`,

  orderFileAccepted: (data: {
    fileName: string;
    pages: number;
    pagesExact: boolean;
    filesCount: number;
    pagesTotal: number;
  }) =>
    `✅ <b>${escapeHtml(data.fileName)}</b>\n` +
    `Сторінок: <b>${data.pages}</b>${data.pagesExact ? "" : " (орієнтовно)"}\n\n` +
    `Файлів: ${data.filesCount}. Разом сторінок: ${data.pagesTotal}.`,

  orderFileDuplicate: `Цей файл уже додано до замовлення.`,

  orderFileTooLarge: (limitMb: number) =>
    `Файл завеликий. Максимум — ${limitMb} МБ на файл.`,

  orderFileUnsupported: (reason: string) =>
    `Не вдалося прийняти файл.\n${escapeHtml(reason)}\n\n` +
    `Підтримуються PDF і DOCX, надіслані як документ.`,

  orderFilesNeed: `Спочатку надішліть хоча б один файл.`,

  orderFileRemoved: (filesCount: number, pagesTotal: number) =>
    `🗑 Файл прибрано. Залишилось файлів: ${filesCount}, сторінок: ${pagesTotal}.`,

  orderProfileIncomplete: `Спочатку заповніть профіль: натисніть /start.`,

  orderLimitFiles: (max: number) =>
    `У замовленні вже ${max} файлів — більше не можна. Натисніть «✅ Завершити вибір».`,

  orderLimitPages: (max: number) =>
    `Перевищено ліміт сторінок: максимум ${max} у замовленні. ` +
    `Натисніть «✅ Завершити вибір» або приберіть файл.`,

  orderAskCopies: (totalPages: number) =>
    `Скільки копій надрукувати?\n\n` +
    `Зараз у замовленні <b>${totalPages}</b> стор.`,

  orderCustomCopies: (max: number) =>
    `Введіть кількість копій числом від 1 до ${max}.`,
  orderCustomCopiesInvalid: (max: number) =>
    `Потрібне ціле число від 1 до ${max}.`,

  orderSummary: (data: {
    files: ReadonlyArray<{ fileName: string; pages: number; pagesExact: boolean }>;
    copies: number;
    totalPages: number;
    amount: string;
    location: string;
    phone: string | null;
    comment?: string;
  }) =>
    `<b>Перевірте замовлення</b>\n\n` +
    data.files
      .map(
        (file, index) =>
          `${index + 1}. ${escapeHtml(file.fileName)} — ${file.pages} стор.${
            file.pagesExact ? "" : " (≈)"
          }`,
      )
      .join("\n") +
    `\n\nСторінок: <b>${data.totalPages}</b> × ${data.copies} коп.\n` +
    `До сплати: <b>${data.amount}</b>\n\n` +
    `Куди нести: ${escapeHtml(data.location)}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}` +
    (data.comment ? `\nКоментар: ${escapeHtml(data.comment)}` : "") +
    (data.files.some((file) => !file.pagesExact)
      ? `\n\n⚠️ Кількість сторінок DOCX орієнтовна: працівник уточнить перед друком.`
      : ""),

  orderCommentPrompt: `Напишіть коментар до замовлення (до 300 символів).`,
  orderCommentTooLong: `Коментар задовгий — максимум 300 символів.`,

  orderCreatedCash: (data: {
    code: string;
    amount: string;
    pages: number;
    copies: number;
    location: string;
  }) =>
    `✅ <b>Замовлення ${escapeHtml(data.code)} створено</b>\n\n` +
    `${data.pages} стор. × ${data.copies} = <b>${data.amount}</b>\n` +
    `Оплата: готівкою при отриманні.\n` +
    `Заберіть: ${escapeHtml(data.location)}\n\n` +
    `Ми напишемо, коли буде готово.`,

  orderCreatedCard: (data: {
    code: string;
    amount: string;
    pages: number;
    copies: number;
    location: string;
  }) =>
    `✅ <b>Замовлення ${escapeHtml(data.code)} створено</b>\n\n` +
    `${data.pages} стор. × ${data.copies} = <b>${data.amount}</b>\n` +
    `Заберіть: ${escapeHtml(data.location)}\n\n` +
    (config.CARD_NUMBER
      ? `Перекажіть суму на картку:\n<code>${escapeHtml(config.CARD_NUMBER)}</code>\n` +
        (config.CARD_RECIPIENT ? `Отримувач: ${escapeHtml(config.CARD_RECIPIENT)}\n` : "") +
        `Призначення: ${escapeHtml(data.code)}\n\n` +
        `Після оплати надішліть скріншот квитанції сюди — працівник підтвердить оплату.`
      : `Реквізити картки надішле адміністратор. Після оплати надішліть квитанцію сюди.`),

  orderRateLimited: (limit: number) =>
    `Забагато замовлень за годину (ліміт — ${limit}). Спробуйте пізніше.`,

  orderCreateFailed: `Не вдалося створити замовлення. Спробуйте ще раз або напишіть адміністратору.`,

  orderSendFilesOnly: `Надішліть файл як документ або натисніть кнопку в повідомленні вище.`,

  staffNewOrder: (data: {
    code: string;
    pages: number;
    copies: number;
    amount: string;
    location: string;
    payment: string;
    comment?: string;
  }) =>
    `🆕 <b>${escapeHtml(data.code)}</b> · ${data.pages} стор. × ${data.copies} · ` +
    `<b>${data.amount}</b> · ${escapeHtml(data.payment)}\n` +
    `Куди: ${escapeHtml(data.location)}` +
    (data.comment ? `\nКоментар: ${escapeHtml(data.comment)}` : ""),

  orderNotFound: `Замовлення не знайдено.`,

  receiptForwarded: `✅ Квитанцію передано працівнику. Після перевірки оплати замовлення піде в друк.`,
  receiptNoStaff: `Квитанцію отримано. Працівник перевірить оплату найближчим часом.`,
  receiptFailed: `Не вдалося передати квитанцію. Напишіть адміністратору.`,

  // ------------------------------------------------------------------ черга

  queueHeader: (freeCount: number, mineCount: number) =>
    `<b>📋 Черга</b>\n\n` +
    `Вільних: <b>${freeCount}</b> · у мене в роботі: <b>${mineCount}</b>`,

  queueItem: (data: {
    code: string;
    pages: number;
    copies: number;
    amount: string;
    location: string;
    payment: string;
    waiting: string;
  }) =>
    `<b>${escapeHtml(data.code)}</b> · ${data.pages} стор. × ${data.copies} = ${data.amount}\n` +
    `${escapeHtml(data.location)} · ${escapeHtml(data.payment)} · чекає ${data.waiting}`,

  orderDetail: (data: {
    code: string;
    status: string;
    paymentStatus: string;
    pages: number;
    pagesExact: boolean;
    copies: number;
    amount: string;
    location: string;
    phone: string | null;
    comment?: string;
    clientName?: string;
    holdReason?: string;
    files: ReadonlyArray<{ fileName: string; pages: number }>;
    createdAt: Date;
  }) =>
    `<b>${escapeHtml(data.code)}</b> · ${data.status}\n` +
    (data.clientName ? `Клієнт: ${escapeHtml(data.clientName)}\n` : "") +
    `Оплата: ${data.paymentStatus}\n\n` +
    `Сторінок: ${data.pages}${data.pagesExact ? "" : " (≈)"} × ${data.copies} коп.\n` +
    `Сума: <b>${data.amount}</b>\n` +
    `Куди: ${escapeHtml(data.location)}\n` +
    (data.phone ? `Телефон: ${formatPhone(data.phone)}\n` : "") +
    (data.comment ? `Коментар: ${escapeHtml(data.comment)}\n` : "") +
    (data.holdReason ? `⚠️ Причина паузи: ${escapeHtml(data.holdReason)}\n` : "") +
    `\nФайли:\n` +
    data.files
      .map((file, index) => `${index + 1}. ${escapeHtml(file.fileName)} — ${file.pages} стор.`)
      .join("\n") +
    `\n\nСтворено: ${formatDateTime(data.createdAt)}`,

  orderTakenClient: (code: string) =>
    `🖨 Ваше замовлення <b>${escapeHtml(code)}</b> друкується.`,
  orderReadyClient: (data: { code: string; location: string }) =>
    `✅ <b>${escapeHtml(data.code)}</b> готове!\nЗабирайте: ${escapeHtml(data.location)}`,
  orderClosedClient: (code: string) =>
    `Дякуємо! Замовлення <b>${escapeHtml(code)}</b> видано.`,
  orderCancelledClient: (data: { code: string; reason?: string }) =>
    `Замовлення <b>${escapeHtml(data.code)}</b> скасовано.` +
    (data.reason ? `\nПричина: ${escapeHtml(data.reason)}` : ""),
  orderHoldClient: (data: { code: string; reason: string }) =>
    `⚠️ Щодо замовлення <b>${escapeHtml(data.code)}</b>: ${escapeHtml(data.reason)}.\n` +
    `Працівник зв'яжеться з вами.`,
  orderResumedClient: (code: string) =>
    `🖨 Замовлення <b>${escapeHtml(code)}</b> знову в роботі.`,

  orderAlreadyTaken: `Це замовлення вже взяв інший працівник.`,
  orderActionNotAllowed: `Ця дія зараз недоступна.`,
  orderFilesUnavailable: `Не вдалося надіслати файли: можливо, клієнт видалив повідомлення.`,

  cashQuestion: (amount: string) => `Гроші отримано (${amount})?`,
  cashConfirmed: `✅ Оплату позначено.`,
  cashNotYet: `Ок, оплата залишається непідтвердженою.`,

  holdReasons: `Що сталося із замовленням?`,
  holdReasonButton: {
    broken: "Файл не читається",
    paper: "Немає паперу",
    client: "Клієнт не відповідає",
  } as const,
  holdSet: (reason: string) => `⚠️ Замовлення на паузі: ${escapeHtml(reason)}.`,

  queueHowTo:
    `Вільних замовлень немає.\nНові з'являться тут автоматично — загляньте пізніше.`,

  ordersWithActions: `Оберіть замовлення, щоб побачити деталі.`,

  cancelDone: `Дію скасовано.`,
  fallback: `Скористайтеся меню нижче або натисніть /start.`,
  unknownMessage: `Надішліть текст або скористайтеся кнопками меню.`,
  profileUpdated: `✅ Оновлено.`,
  roleLine: (role: Role) => `Ваша роль: <b>${roleLabel(role)}</b>`,
};
