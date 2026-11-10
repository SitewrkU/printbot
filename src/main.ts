import { createBot } from "./bot/index.js";
import { config } from "./app-config.js";
import { prisma } from "./infra/db.js";
import { logger } from "./infra/logger.js";
import { createServer } from "./http/server.js";

async function main(): Promise<void> {
  const app = createServer();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT }, "http server started");

  const bot = createBot();
  const me = await bot.api.getMe();
  logger.info({ username: me.username }, "telegram bot authorized");

  await bot.api.setMyCommands([
    { command: "start", description: "Головне меню" },
    { command: "help", description: "Допомога" },
    { command: "cancel", description: "Скасувати поточну дію" },
  ]);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "shutting down");

    try {
      await bot.stop();
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  logger.info({ printName: config.PRINT_NAME }, "starting long polling");
  await bot.start({
    onStart: () => logger.info("telegram polling started"),
  });
}

main().catch((error) => {
  logger.error({ err: error }, "fatal error");
  process.exit(1);
});
