import Fastify from "fastify";
import { prisma } from "../infra/db.js";
import { logger } from "../infra/logger.js";

export function createServer() {
  const app = Fastify({ loggerInstance: logger });
  const startedAt = new Date().toISOString();
  const commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7);

  app.get("/health", async () => ({
    status: "ok",
    uptime: Math.round(process.uptime()),
    startedAt,
    ...(commit ? { commit } : {}),
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
