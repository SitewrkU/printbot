import { z } from "zod";

/** "true"/"false"/"1"/"0" -> boolean (z.coerce.boolean вважає "false" за true). */
const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN обов'язковий"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обов'язковий"),

  ADMIN_TELEGRAM_IDS: z.string().default(""),
  STAFF_CHAT_ID: z.string().optional(),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  PRINT_NAME: z.string().min(1).default("Друкарська, 48б"),
  WORK_HOURS: z.string().min(1).default("щодня 18:00–22:00"),
  SUPPORT_CONTACT: z.string().default(""),

  PRICE_PER_PAGE_KOP: z.coerce.number().int().positive().default(300),
  MAX_FILES_PER_ORDER: z.coerce.number().int().positive().default(10),
  MAX_PAGES_PER_ORDER: z.coerce.number().int().positive().default(300),
  MAX_COPIES: z.coerce.number().int().positive().default(50),

  CARD_TRANSFER_ENABLED: booleanString.default("true"),
  CARD_NUMBER: z.string().default(""),
  CARD_RECIPIENT: z.string().default(""),
});

export type AppConfig = z.infer<typeof envSchema> & {
  adminTelegramIds: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Некоректна конфігурація: ${details}`);
  }

  return {
    ...parsed.data,
    adminTelegramIds: parsed.data.ADMIN_TELEGRAM_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}
