-- Блокування клієнтів: працівник/адмін може обмежити нові замовлення
ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "users" ADD COLUMN "blockedAt" TIMESTAMP(3);
