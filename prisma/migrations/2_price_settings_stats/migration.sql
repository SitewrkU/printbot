-- Ціна: підтвердження клієнтом, налаштування бота, добова статистика
ALTER TABLE "orders" ADD COLUMN "priceConfirmed" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "daily_stats" (
    "day" DATE NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "revenueKop" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("day")
);
