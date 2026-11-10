import { createBot } from "./bot/index.js";
import { config } from "./app-config.js";
import { autoCloseReadyOrders, cleanupOldOrders } from "./domain/queue.js";
import { prisma } from "./infra/db.js";
import { logger } from "./infra/logger.js";
import { createServer } from "./http/server.js";

const AUTO_CLOSE_INTERVAL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
  const autoCloseTimer = setInterval(() => {
    void autoCloseReadyOrders()
      .then((closed) => {
        if (closed > 0) {
          logger.info({ closed }, "auto-closed ready orders");
        }
      })
      .catch((error) => logger.error({ err: error }, "auto-close failed"));
  }, AUTO_CLOSE_INTERVAL_MS);

  const cleanup = () => {
    void cleanupOldOrders(new Date(), config.ORDER_RETENTION_DAYS)
      .then((result) => {
        if (result.deleted > 0) {
          logger.info(result, "old orders cleaned up");
        }
      })
      .catch((error) => logger.error({ err: error }, "cleanup failed"));
  };
  const cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  setTimeout(cleanup, 2 * 60 * 1000);

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    clearInterval(autoCloseTimer);
    clearInterval(cleanupTimer);
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
