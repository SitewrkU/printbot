import type { InlineKeyboard } from "grammy";
import type { BotContext } from "./context.js";

type ReplyMarkup = InlineKeyboard | { remove_keyboard: true };

/** Редагує попереднє повідомлення з меню, а якщо не вийшло — надсилає нове. */
export async function editOrReply(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const options = { parse_mode: "HTML" as const, reply_markup: keyboard };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch {
      // Повідомлення застаріле або те саме — надсилаємо нове.
    }
  }

  await ctx.reply(text, options);
}

export async function replyHtml(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard | { remove_keyboard: true },
): Promise<void> {
  const reply_markup: ReplyMarkup | undefined = keyboard;
  await ctx.reply(text, { parse_mode: "HTML", reply_markup });
}
