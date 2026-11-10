import type { Context } from "grammy";
import type { User as DbUser } from "@prisma/client";

export type BotContext = Context & { user?: DbUser };

/** Middleware гарантує, що ctx.user встановлений до хендлерів. */
export function currentUser(ctx: BotContext): DbUser {
  if (!ctx.user) {
    throw new Error("ctx.user не встановлено: перевірте порядок middleware");
  }
  return ctx.user;
}
