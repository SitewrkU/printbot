import Fastify from "fastify";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";

export function createServer() {
  const app = Fastify({ loggerInstance: logger });

  app.get("/health", async () => ({
    status: "ok",
    uptime: Math.round(process.uptime()),
  }));

  app.get("/health/db", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "down" });
    }
  });

  return app;
}
