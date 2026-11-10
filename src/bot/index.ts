import { Bot } from "grammy";
import { config } from "../app-config.js";
import { ensureUser } from "../domain/users.js";
import { logger } from "../infra/logger.js";
import type { BotContext } from "./context.js";
import {
  handleAdminCommand,
  handleCallback,
  handleCancel,
  handleContact,
  handleHelp,
  handleStart,
  handleText,
} from "./handlers.js";
import { texts } from "./texts.js";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.is_bot) {
      return;
    }
    ctx.user = await ensureUser(BigInt(ctx.from.id), config.adminTelegramIds);
    await next();
  });

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("cancel", handleCancel);
  bot.command("admin", handleAdminCommand);

  bot.on("message:contact", handleContact);
  bot.on("message:text", handleText);
  bot.on("callback_query:data", handleCallback);

  bot.on("message:document", async (ctx) => {
    await ctx.reply(texts.newOrderSoon, { parse_mode: "HTML" });
  });

  bot.on("message", async (ctx) => {
    await ctx.reply(texts.unknownMessage, { parse_mode: "HTML" });
  });

  bot.catch((error) => {
    logger.error(
      { err: error.error, updateId: error.ctx.update.update_id },
      "bot handler failed",
    );
  });

  return bot;
}
