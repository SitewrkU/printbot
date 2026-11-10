# PrintBot

Telegram-бот для замовлень друку: клієнт надсилає PDF/DOCX, бот рахує сторінки й ціну, замовлення потрапляє в чергу до працівників друкарні.

> Стан проєкту: **E0** — скелет, реєстрація, ролі, адмінка працівників.
> Технічне завдання — [`docs/SPEC.md`](docs/SPEC.md).

## Стек

- Node.js 22+, TypeScript (strict)
- [grammY](https://grammy.dev) — Telegram-бот (long polling)
- Fastify — `/health` (пізніше — вебхуки оплати)
- Prisma + PostgreSQL
- Zod, Pino, Vitest

## Швидкий старт

```bash
# 1. Підняти Postgres локально (ПРОПУСТІТЬ, якщо DATABASE_URL вказує на Neon)
docker compose up -d

# 2. Налаштувати оточення
cp .env.example .env
#    вписати BOT_TOKEN (від @BotFather) і ADMIN_TELEGRAM_IDS

# 3. Встановити залежності та створити таблиці
npm install
npm run db:deploy

# 4. Запустити
npm run dev
```

Бот працює через long polling, тому публічний HTTPS для локальної розробки не потрібен.

### Windows / PowerShell

Якщо `npm` падає з `running scripts is disabled on this system`, використовуйте `npm.cmd` або дозвольте локальні скрипти:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Скрипти

| Команда | Що робить |
|---|---|
| `npm run dev` | запуск з автоперезапуском (tsx) |
| `npm run build` | компіляція в `dist/` |
| `npm start` | запуск зібраного бота |
| `npm run typecheck` | перевірка типів |
| `npm test` | unit-тести |
| `npm run db:migrate` | нова міграція в dev |
| `npm run db:deploy` | застосувати міграції (production) |
| `npm run db:studio` | Prisma Studio |

## Що вже працює (E0)

- `/start` — реєстрація: ім'я → телефон (кнопка «поділитися номером» або вручну) → кімната → підтвердження.
- Дані зберігаються; при наступних заходах реєстрація не повторюється.
- Профіль: перегляд і редагування імені, телефону, локації.
- Ролі: клієнт / працівник / адміністратор.
- Адмінка: список працівників, додавання за Telegram ID, зняття ролі.
- Заглушки для «Нове замовлення» та «Черга» (E1/E2).
- `/health` і `/health/db` для моніторингу.

## Структура

```
src/
  bot/          хендлери, тексти, клавіатури, стан діалогу
  domain/       ціни, статуси, телефони, ролі, користувачі
  infra/        Prisma, логер
  http/         Fastify
prisma/         схема БД
docs/SPEC.md    технічне завдання
tests/          unit-тести
```

## Деплой

Покрокова інструкція для безкоштовного хостингу (Neon + Render + GitHub) — [`docs/DEPLOY.md`](docs/DEPLOY.md).

Docker-образ збирається з `Dockerfile`, міграції застосовуються на старті контейнера:

```bash
docker build -t printbot .
docker run --env-file .env -p 3000:3000 printbot
```

Мінімум для хмари: `BOT_TOKEN` і `DATABASE_URL` (Neon). `PORT` Render підставить сам.
