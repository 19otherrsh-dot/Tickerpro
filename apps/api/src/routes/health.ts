import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { pingRedis, queuesEnabled } from "../lib/queue.js";

export async function healthRoutes(app: FastifyInstance) {
  // Liveness: is the process up? (Cheap — no dependency checks.)
  app.get("/", async (_request, _reply) => {
    return {
      status: "ok",
      service: "tickerpro-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness: can we actually serve traffic? Checks real dependency health and
  // returns 503 when a critical dependency (the database) is unavailable, so the
  // orchestrator stops routing traffic to this instance.
  app.get("/ready", async (_request, reply) => {
    const checks: Record<string, "ok" | "down" | "not_configured"> = {
      database: "down",
      redis: "not_configured",
    };

    // Database is critical — a real query, not a hardcoded "ok".
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch (err) {
      app.log.error(err, "[health] database readiness check failed");
    }

    // Redis is optional (queues degrade to inline). Report but don't fail on it.
    if (queuesEnabled) {
      checks.redis = (await pingRedis()) ? "ok" : "down";
    }

    const ready = checks.database === "ok";
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks,
    });
  });
}
