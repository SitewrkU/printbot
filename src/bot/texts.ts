import { config } from "../app-config.js";
import { formatUah } from "../domain/pricing.js";
import { formatPhone } from "../domain/phone.js";
import { roleLabel, type Role } from "../domain/roles.js";
import { statusEmoji } from "../domain/statuses.js";

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
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

const developerLink = () =>
  config.DEVELOPER_URL
    ? `<a href="${escapeHtml(config.DEVELOPER_URL)}">${escapeHtml(config.DEVELOPER_NAME)}</a>`
    : escapeHtml(config.DEVELOPER_NAME);

const developerLine = () => `🤖 Розробник: ${developerLink()}`;

const tipCardBlock = () =>
  config.DEVELOPER_TIP_CARD
    ? `\n\n☕ <i>Не обов'язково:</i> хочете подякувати розробнику за бота — ` +
      `можна закинути на каву:\n<code>${escapeHtml(config.DEVELOPER_TIP_CARD)}</code>\n` +
      `Це не оплата замовлення.`
    : "";

export const texts = {
  welcome: (name?: string) =>
    `👋 <b>Вітаємо${name ? `, ${escapeHtml(name)}` : ""}!</b>\n\n` +
    `Це бот друкарні «${escapeHtml(config.PRINT_NAME)}».\n\n` +
    `🖨 <b>Як це працює</b>\n` +
    `1️⃣ Надсилаєте PDF або DOCX\n` +
    `2️⃣ Бот рахує сторінки й показує ціну\n` +
    `3️⃣ Забираєте роздруківку\n\n` +
    `💰 <b>${price()}</b>, кольоровий друк.\n` +
    `📍 Видача: <b>${escapeHtml(config.PICKUP_POINT)}</b>.\n` +
    `🕒 Графік: ${escapeHtml(config.WORK_HOURS)}\n\n` +
    developerLine(),

  askName:
    `Як до вас звертатися?\n\n` +
    `Напишіть ім'я — прізвище вказувати не обов'язково (але можна, якщо хочете).\n` +
    `Це потрібно лише працівникам друкарні, щоб знати, чиє замовлення. Дані не публікуються.`,
  invalidName: `Будь ласка, вкажіть ім'я (2–60 символів). Прізвище не обов'язкове.`,

  askPhone:
    `Надішліть номер телефону — він потрібен лише для зв'язку щодо замовлення.\n\n` +
    `• кнопкою нижче, або\n` +
    `• вручну у форматі <code>+380501234567</code>`,
  invalidPhone: `Не вдалося розпізнати номер. Формат: <code>+380501234567</code>.`,

  askLocation:
    `Вкажіть вашу кімнату у гуртожитку: <b>номер + б/п</b> (бічна/пряма).\n` +
    `Вона потрібна лише для того, щоб працівник знав, кому віддати замовлення.\n\n` +
    `Наприклад: <code>25б</code> або <code>33п</code>.`,
  invalidLocation:
    `Некоректна кімната. Потрібно: 1–2 цифри та літера <code>б</code> або <code>п</code>.\n` +
    `Наприклад: <code>25б</code>, <code>33п</code>.`,

  confirmProfile: (data: { fullName?: string; phone?: string; location?: string }) =>
    `<b>Перевірте дані</b>\n\n` +
    `Ім'я: ${escapeHtml(data.fullName ?? "—")}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}\n` +
    `Кімната: ${escapeHtml(data.location ?? "—")}\n\n` +
    `Видача: ${escapeHtml(config.PICKUP_POINT)}\n\n` +
    `<i>Ці дані бачить лише друкарня. Змінити їх можна в профілі.</i>`,

  profileSaved: `✅ Дані збережено — наступного разу вводити не потрібно.`,

  mainMenu: (name?: string) =>
    `${name ? `Привіт, <b>${escapeHtml(name)}</b>! 👋` : "<b>Головне меню</b>"}\n\n` +
    `Оберіть дію нижче.`,

  profile: (data: {
    fullName?: string | null;
    phone?: string | null;
    location?: string | null;
    role: Role;
  }) =>
    `<b>Мій профіль</b>\n\n` +
    `Ім'я: ${escapeHtml(data.fullName ?? "—")}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}\n` +
    `Кімната: ${escapeHtml(data.location ?? "—")}\n` +
    `Роль: ${roleLabel(data.role)}`,

  help:
    `<b>ℹ️ Допомога</b>\n\n` +
    `<b>🖨 Як зробити замовлення</b>\n` +
    `1. Натисніть «🖨 Нове замовлення».\n` +
    `2. Надішліть PDF або DOCX як <b>документ</b> (скріпка → «Файл»).\n` +
    `3. Оберіть кількість копій і спосіб оплати.\n` +
    `4. Підтвердіть замовлення — воно з'явиться в черзі працівника.\n\n` +
    `<b>💰 Ціна</b>\n` +
    `${price()} × кількість сторінок × копії.\n` +
    `Якщо у файлі багато кольору або чорної заливки, працівник може ` +
    `перерахувати ціну — ви отримаєте нову суму й підтвердите її.\n\n` +
    `<b>💳 Оплата</b>\n` +
    `• готівкою при отриманні;\n` +
    `• переказом на картку — після переказу натисніть «✅ Я оплатив» ` +
    `у «📄 Мої замовлення».\n\n` +
    `<b>📦 Видача</b>\n` +
    `📍 ${escapeHtml(config.PICKUP_POINT)}\n` +
    `🕒 ${escapeHtml(config.WORK_HOURS)}\n` +
    `Коли замовлення готове, бот надішле повідомлення.\n\n` +
    `<b>📏 Ліміти</b>\n` +
    `${limits()}\n` +
    (config.SUPPORT_CONTACT
      ? `\n<b>🆘 Підтримка:</b> ${escapeHtml(config.SUPPORT_CONTACT)}\n`
      : "") +
    `\n${developerLine()}`,

  ordersEmpty: `У вас ще немає замовлень. Натисніть «🖨 Нове замовлення», щоб створити перше.`,
  ordersHeader: (count: number) =>
    `<b>📄 Мої замовлення</b>\n\nУсього: <b>${count}</b>. Оберіть замовлення нижче, щоб побачити деталі.`,

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
    `${statusEmoji(order.status)} <b>${escapeHtml(order.code)}</b> · ${order.status}\n` +
    `📄 ${order.pages} стор. × ${order.copies} · 💰 ${order.amount}`,

  // --------------------------------------------------------------- замовлення

  orderRules:
    `<b>🖨 Нове замовлення</b>\n\n` +
    `Надішліть файли як <b>документи</b> (скріпка → «Файл»), не як фото.\n` +
    `Формати: PDF, DOCX. Друк кольоровий.\n\n` +
    `<b>Ліміти:</b> ${limits()}\n` +
    `<b>Ціна:</b> ${price()}.\n` +
    `Якщо у файлі дуже багато кольору або чорної заливки, працівник може ` +
    `перерахувати ціну — ви отримаєте нову суму й підтвердите її.\n\n` +
    `Після кожного файлу покажу кількість сторінок. Коли все надіслано — натисніть «✅ Далі — копії».`,

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
  orderRoomRequired:
    `Спочатку вкажіть кімнату у форматі <code>25б</code> або <code>33п</code> — ` +
    `вона потрібна, щоб знайти вас у гуртожитку.`,

  orderLimitFiles: (max: number) =>
    `У замовленні вже ${max} файлів — більше не можна. Натисніть «✅ Далі — копії».`,

  orderLimitPages: (max: number) =>
    `Перевищено ліміт сторінок: максимум ${max} у замовленні. ` +
    `Натисніть «✅ Далі — копії» або приберіть файл.`,

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
    room: string;
    phone: string | null;
    comment?: string;
  }) =>
    `<b>🧾 Перевірте замовлення</b>\n\n` +
    `<b>📎 Файли</b>\n` +
    data.files
      .map(
        (file, index) =>
          `${index + 1}. ${escapeHtml(file.fileName)} — ${file.pages} стор.${
            file.pagesExact ? "" : " (≈)"
          }`,
      )
      .join("\n") +
    `\n\n<b>📊 Розрахунок</b>\n` +
    `Сторінок: <b>${data.totalPages}</b> × ${data.copies} коп.\n` +
    `До сплати: <b>${data.amount}</b>\n\n` +
    `<b>📍 Отримання</b>\n` +
    `Кімната: ${escapeHtml(data.room)}\n` +
    `Забрати: ${escapeHtml(config.PICKUP_POINT)}\n` +
    `Телефон: ${data.phone ? formatPhone(data.phone) : "—"}` +
    (data.comment ? `\n💬 Коментар: ${escapeHtml(data.comment)}` : "") +
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
    room: string;
  }) =>
    `✅ <b>Замовлення ${escapeHtml(data.code)} створено</b>\n\n` +
    `<b>📄 ${data.pages} стор. × ${data.copies} коп. = ${data.amount}</b>\n` +
    `💵 Оплата: готівкою при отриманні\n` +
    `🚪 Ваша кімната: ${escapeHtml(data.room)}\n` +
    `📍 Забрати: ${escapeHtml(config.PICKUP_POINT)}\n\n` +
    `⏳ Ми напишемо, коли замовлення буде готове.`,

  orderCreatedCard: (data: {
    code: string;
    amount: string;
    pages: number;
    copies: number;
    room: string;
  }) =>
    `✅ <b>Замовлення ${escapeHtml(data.code)} створено</b>\n\n` +
    `<b>📄 ${data.pages} стор. × ${data.copies} коп. = ${data.amount}</b>\n` +
    `🚪 Ваша кімната: ${escapeHtml(data.room)}\n` +
    `📍 Забрати: ${escapeHtml(config.PICKUP_POINT)}\n\n` +
    (config.CARD_NUMBER
      ? `<b>💳 Оплата карткою</b>\n` +
        `Сума: <b>${data.amount}</b>\n` +
        `Картка: <code>${escapeHtml(config.CARD_NUMBER)}</code>\n` +
        (config.CARD_RECIPIENT
          ? `Отримувач: ${escapeHtml(config.CARD_RECIPIENT)}\n`
          : "") +
        `Призначення: <code>${escapeHtml(data.code)}</code>\n\n` +
        `1️⃣ Перекажіть суму\n` +
        `2️⃣ Натисніть «✅ Я оплатив» у «📄 Мої замовлення»\n` +
        `3️⃣ Працівник підтвердить оплату\n\n` +
        `Квитанцію можна надіслати сюди за бажанням.`
      : `Реквізити картки надішле адміністратор.\n` +
        `Після переказу натисніть «✅ Я оплатив» у «📄 Мої замовлення».`) +
    tipCardBlock(),

  orderRateLimited: (limit: number) =>
    `Забагато замовлень за годину (ліміт — ${limit}). Спробуйте пізніше.`,

  orderCreateFailed: `Не вдалося створити замовлення. Спробуйте ще раз або напишіть адміністратору.`,

  orderSendFilesOnly: `Надішліть файл як документ або натисніть кнопку в повідомленні вище.`,

  staffNewOrder: (data: {
    code: string;
    pages: number;
    copies: number;
    amount: string;
    room: string;
    payment: string;
    comment?: string;
  }) =>
    `🆕 <b>Нове замовлення ${escapeHtml(data.code)}</b>\n\n` +
    `📄 ${data.pages} стор. × ${data.copies} коп. · 💰 <b>${data.amount}</b>\n` +
    `💳 Оплата: ${escapeHtml(data.payment)}\n` +
    `🚪 Кімната: ${escapeHtml(data.room)}` +
    (data.comment ? `\n💬 Коментар: ${escapeHtml(data.comment)}` : "") +
    `\n\n👉 Відкрийте «📋 Черга», щоб взяти замовлення.`,

  orderNotFound: `Замовлення не знайдено.`,

  receiptForwarded: `✅ Квитанцію передано працівнику. Після перевірки оплати замовлення піде в друк.`,
  receiptNoStaff: `Квитанцію отримано. Працівник перевірить оплату найближчим часом.`,
  receiptFailed: `Не вдалося передати квитанцію. Напишіть адміністратору.`,

  // ------------------------------------------------------------------ черга

  queueHeader: (
    freeCount: number,
    mineCount: number,
    updatedAt: Date = new Date(),
  ) =>
    `<b>📋 Черга замовлень</b>\n\n` +
    `🆓 Вільних: <b>${freeCount}</b> · 🖨 У мене: <b>${mineCount}</b>\n` +
    `🕒 Оновлено: ${formatTime(updatedAt)}`,

  queueItem: (data: {
    code: string;
    status: string;
    pages: number;
    copies: number;
    amount: string;
    room: string;
    payment: string;
    waiting: string;
  }) =>
    `${statusEmoji(data.status)} <b>${escapeHtml(data.code)}</b> · ${data.pages} стор. × ${data.copies}\n` +
    `💰 ${data.amount} · ${escapeHtml(data.payment)}\n` +
    `🚪 Кімната ${escapeHtml(data.room)} · ⏱ ${data.waiting}`,

  orderDetail: (data: {
    code: string;
    status: string;
    statusIcon: string;
    paymentMethod: string;
    paymentStatus: string;
    pages: number;
    pagesExact: boolean;
    copies: number;
    amount: string;
    priceConfirmed: boolean;
    room: string;
    phone: string | null;
    comment?: string;
    clientName?: string;
    clientBlocked?: boolean;
    holdReason?: string;
    files: ReadonlyArray<{ fileName: string; pages: number }>;
    createdAt: Date;
    hint?: string;
  }) =>
    `${data.statusIcon} <b>${escapeHtml(data.code)}</b> · ${data.status}\n` +
    `━━━━━━━━━━━━━━\n` +
    (data.clientName ? `👤 Клієнт: ${escapeHtml(data.clientName)}\n` : "") +
    (data.clientBlocked ? `🚫 Клієнт заблокований\n` : "") +
    `🚪 Кімната: ${escapeHtml(data.room)}\n` +
    `📍 Забрати: ${escapeHtml(config.PICKUP_POINT)}\n` +
    (data.phone ? `📞 Телефон: ${formatPhone(data.phone)}\n` : "") +
    (data.comment ? `💬 Коментар: ${escapeHtml(data.comment)}\n` : "") +
    `\n<b>📄 Замовлення</b>\n` +
    `Сторінок: ${data.pages}${data.pagesExact ? "" : " (≈)"} × ${data.copies} коп.\n` +
    `💰 Сума: <b>${data.amount}</b>` +
    (data.priceConfirmed
      ? "\n"
      : ` ⚠️ <i>очікує підтвердження клієнтом</i>\n`) +
    `💳 Оплата: ${data.paymentMethod} · ${data.paymentStatus}\n` +
    (data.holdReason ? `⚠️ Пауза: ${escapeHtml(data.holdReason)}\n` : "") +
    `\n<b>📎 Файли</b>\n` +
    data.files
      .map(
        (file, index) =>
          `${index + 1}. ${escapeHtml(file.fileName)} — ${file.pages} стор.`,
      )
      .join("\n") +
    `\n\n🕒 Створено: ${formatDateTime(data.createdAt)}` +
    (data.hint ? `\n\n💡 <i>${data.hint}</i>` : ""),

  orderTakenClient: (code: string) =>
    `🖨 Ваше замовлення <b>${escapeHtml(code)}</b> друкується.`,
  orderReadyClient: (code: string) =>
    `✅ <b>${escapeHtml(code)}</b> готове!\nЗабирайте: ${escapeHtml(config.PICKUP_POINT)}`,
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

  // ------------------------------------------------- ціна, оплата, оголошення

  pricePrompt: (current: string) =>
    `<b>💰 Зміна ціни</b>\n\n` +
    `Зараз: <b>${current}</b>.\n\n` +
    `Введіть нову суму в гривнях (наприклад <code>45</code> або <code>45.50</code>).\n` +
    `Можна додати причину через риску: <code>45 | багато кольору</code>.`,
  priceInvalid:
    `Некоректна сума. Введіть число від 1 до 1000 грн, наприклад <code>45</code> або <code>45.50 | багато кольору</code>.`,
  priceChangedStaff: (data: { code: string; amount: string; reason: string }) =>
    `✅ Ціну <b>${escapeHtml(data.code)}</b> змінено на <b>${data.amount}</b>.\n` +
    `Причина: ${escapeHtml(data.reason)}.\n` +
    `Клієнт має підтвердити нову суму.`,
  priceChangedClient: (data: { code: string; amount: string; reason: string }) =>
    `<b>💰 Змінилася ціна замовлення ${escapeHtml(data.code)}</b>\n\n` +
    `Нова сума: <b>${data.amount}</b>\n` +
    `Причина: ${escapeHtml(data.reason)}\n\n` +
    `Погоджуєтеся? Якщо ні — замовлення буде скасовано.`,
  priceAgreedClient: (code: string) =>
    `✅ Дякуємо! Ціну замовлення <b>${escapeHtml(code)}</b> погоджено.`,
  priceDeclinedClient: (code: string) =>
    `Замовлення <b>${escapeHtml(code)}</b> скасовано без друку.`,
  priceAgreedStaff: (data: { code: string; amount: string }) =>
    `✅ Клієнт погодив ціну <b>${escapeHtml(data.code)}</b> — <b>${data.amount}</b>. Можна друкувати.`,
  priceDeclinedStaff: (code: string) =>
    `❌ Клієнт не погодився з ціною <b>${escapeHtml(code)}</b>. Замовлення скасовано.`,

  rejectReasons: `Чому відхиляємо замовлення?`,
  rejectReasonButton: {
    color: "Багато кольору",
    file: "Файл нечитабельний",
  } as const,
  rejectedStaff: (code: string) => `❌ Замовлення <b>${escapeHtml(code)}</b> відхилено.`,
  rejectedClient: (data: { code: string; reason: string }) =>
    `Замовлення <b>${escapeHtml(data.code)}</b> відхилено.\n` +
    `Причина: ${escapeHtml(data.reason)}.`,

  paymentRequestedClient: `✅ Позначили, що ви оплатили. Працівник перевірить і підтвердить.`,
  paymentRequestedStaff: (data: { code: string; amount: string }) =>
    `💳 <b>Клієнт позначив оплату</b>\n\n` +
    `Замовлення: <b>${escapeHtml(data.code)}</b>\n` +
    `Сума: <b>${data.amount}</b>\n\n` +
    `Перевірте надходження й натисніть «💳 Оплату підтверджено» у картці замовлення.`,
  paymentConfirmedClient: (code: string) =>
    `✅ Оплату замовлення <b>${escapeHtml(code)}</b> підтверджено.`,

  staffMenu: `<b>🛠 Службове меню</b>\n\nКерування чергою, оголошеннями та клієнтами.`,
  orderingStatus: (enabled: boolean) =>
    enabled
      ? `📥 Прийом замовлень: <b>увімкнено</b> ✅`
      : `⏸ Прийом замовлень: <b>вимкнено</b>`,
  announcementPrompt:
    `Напишіть текст оголошення для всіх користувачів (до 2000 символів).\n\n` +
    `Наприклад: «Сьогодні не друкуємо, немає паперу. Вибачте!»`,
  announcementTooShort: `Оголошення закоротке — напишіть хоча б кілька слів.`,
  announcementTooLong: `Оголошення задовге — максимум 2000 символів.`,
  announcementSent: (data: { sent: number; failed: number }) =>
    `📢 Оголошення надіслано.\nДоставлено: <b>${data.sent}</b>` +
    (data.failed > 0 ? `, не доставлено: ${data.failed}` : "") +
    `.`,
  orderingEnabledMessage: `▶️ Прийом замовлень увімкнено.`,
  orderingDisabledMessage:
    `⏸ Прийом замовлень вимкнено. Нові замовлення створювати не можна, ` +
    `а ті, що вже в черзі, обробляються далі.`,
  orderingDisabled: (announcement: string | null) =>
    `⏸ <b>Прийом замовлень тимчасово призупинено.</b>\n\n` +
    (announcement ? `${escapeHtml(announcement)}\n\n` : "") +
    `Спробуйте пізніше.`,
  orderingDisabledShort: `⏸ Прийом замовлень тимчасово призупинено.`,

  // ------------------------------------------------------ блокування клієнтів

  blockedNotice: (reason: string | null) =>
    `🚫 <b>Нові замовлення заблоковано</b>\n\n` +
    (reason ? `Причина: ${escapeHtml(reason)}\n\n` : "") +
    `Ви не можете створювати нові замовлення. ` +
    (config.SUPPORT_CONTACT
      ? `Зверніться до адміністратора: ${escapeHtml(config.SUPPORT_CONTACT)}.`
      : `Зверніться до адміністратора друкарні.`),
  blockedShort: `🚫 Нові замовлення заблоковано.`,
  blockReasonPrompt: (name: string, code: string) =>
    `<b>🚫 Блокування клієнта</b>\n\n` +
    `Клієнт: <b>${escapeHtml(name)}</b>\n` +
    `Замовлення: ${escapeHtml(code)}\n\n` +
    `Напишіть причину блокування (3–200 символів).\n` +
    `Наприклад: «спамить однаковими замовленнями» або «не забирає готові замовлення».`,
  blockReasonInvalid: `Причина має містити 3–200 символів. Спробуйте ще раз.`,
  blockedDone: (data: { name: string; code: string; reason: string }) =>
    `🚫 <b>${escapeHtml(data.name)}</b> заблокований(а).\n` +
    `Причина: ${escapeHtml(data.reason)}\n` +
    `Замовлення ${escapeHtml(data.code)} лишається в роботі — клієнт зможе його забрати.`,
  blockedClient: (reason: string) =>
    `🚫 <b>Вам обмежено створення нових замовлень.</b>\n\n` +
    `Причина: ${escapeHtml(reason)}\n\n` +
    `Якщо це помилка — зверніться до адміністратора друкарні.`,
  blockStaffImpossible: `Не можна блокувати працівника або адміністратора.`,
  unblockedDone: (name: string) =>
    `✅ <b>${escapeHtml(name)}</b> розблокований(а) — може знову створювати замовлення.`,
  unblockedClient: `✅ Вам знову дозволено створювати замовлення. Дякуємо!`,
  blockedListEmpty: `Заблокованих користувачів немає.`,
  blockedListHeader: (count: number) =>
    `<b>🚫 Заблоковані клієнти</b>\n\nУсього: <b>${count}</b>. ` +
    `Натисніть на ім'я, щоб розблокувати.`,
  blockedUserLine: (data: {
    name: string;
    room: string | null;
    reason: string | null;
    blockedAt: Date | null;
  }) =>
    `🚫 <b>${escapeHtml(data.name)}</b>` +
    (data.room ? ` · кімн. ${escapeHtml(data.room)}` : "") +
    (data.reason ? `\nПричина: ${escapeHtml(data.reason)}` : "") +
    (data.blockedAt ? `\nЗаблоковано: ${formatDateTime(data.blockedAt)}` : ""),

  cancelDone: `Дію скасовано.`,
  fallback: `Скористайтеся меню нижче або натисніть /start.`,
  unknownMessage: `Надішліть текст або скористайтеся кнопками меню.`,
  profileUpdated: `✅ Оновлено.`,
  roleLine: (role: Role) => `Ваша роль: <b>${roleLabel(role)}</b>`,
};
