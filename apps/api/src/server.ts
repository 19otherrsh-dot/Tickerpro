import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { initObservability, captureException } from "./lib/observability.js";

// Routes
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { contactRoutes } from "./routes/contacts.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { broadcastRoutes } from "./routes/broadcasts.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { healthRoutes } from "./routes/health.js";
import { wsRoutes } from "./routes/ws.js";
import { chatbotRoutes } from "./routes/chatbots.js";
import { integrationRoutes } from "./routes/integrations.js";
import { publicApiRoutes } from "./routes/public-api.js";
import { knowledgeRoutes } from "./routes/knowledge.js";
import { paymentRoutes } from "./routes/payments.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { commerceRoutes } from "./routes/commerce.js";
import { catalogRoutes } from "./routes/catalog.js";
import { templateRoutes } from "./routes/templates.js";
import { flowRoutes } from "./routes/flows.js";
import { dripRoutes } from "./routes/drips.js";
import { adsRoutes } from "./routes/ads.js";
import { copilotRoutes } from "./routes/copilot.js";
import { auditRoutes } from "./routes/audit.js";
import { webhookManagementRoutes } from "./routes/webhook-management.js";
import { segmentRoutes } from "./routes/segments.js";
import { billingRoutes } from "./routes/billing.js";
dotenv.config();

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(10),
  CORS_ORIGIN: z.string().optional(),
  REDIS_URL: z.string().optional(), // enables durable broadcast/drip queues
  // Webhook signature secrets — optional locally, but enforced (fail-closed)
  // inside the webhook handlers when NODE_ENV=production.
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  SHOPIFY_API_SECRET: z.string().optional(),
});

// In production, the verify token must be set (Meta requires an exact match)
// and must not be the shipped placeholder.
if (process.env.NODE_ENV === "production") {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken || verifyToken === "tickerpro-verify-token") {
    console.error("❌ META_WEBHOOK_VERIFY_TOKEN must be set to a non-default value in production");
    process.exit(1);
  }
}

// Validate ENV at startup
try {
  envSchema.parse(process.env);
} catch (err: any) {
  console.error("❌ Invalid environment variables:", err.errors);
  process.exit(1);
}

const server = Fastify({
  // Generate a request id per request (honoring an upstream x-request-id) so
  // logs and error reports can be correlated end to end.
  genReqId: (req) => (req.headers["x-request-id"] as string) || crypto.randomUUID(),
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    // Never leak credentials/tokens into logs (structured JSON in production).
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-hub-signature-256"]',
      'req.headers["x-shopify-hmac-sha256"]',
      "req.headers['x-api-key']",
    ],
  },
});

// Preserve the raw request body so webhook HMAC signatures can be verified
// against the exact bytes Meta/Shopify signed (a re-serialized object never
// matches). Still parses JSON for normal route handlers.
server.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (req, body: string, done) => {
    (req as any).rawBody = body;
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      (err as any).statusCode = 400;
      done(err as Error, undefined);
    }
  }
);

// ─── Plugins ─────────────────────────────────────────────────────────────────

await server.register(cors, {
  origin: process.env.NODE_ENV === "production" 
    ? (process.env.CORS_ORIGIN || "https://app.tickerpro.com") 
    : "http://localhost:3000",
  credentials: true,
});

// JWT_SECRET is validated as required (min 10 chars) by envSchema above, so we
// use it directly — no weak dev fallback that could silently run in production.
await server.register(jwt, {
  secret: process.env.JWT_SECRET as string,
  cookie: { cookieName: "token", signed: false },
});

await server.register(cookie);

await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await server.register(websocket);
await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ─── Error Handling ────────────────────────────────────────────────────────
// Turn Zod validation failures into clean 400s, and ensure internal errors
// never leak stack traces / messages to clients in production.
server.setErrorHandler((error: any, request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      error: "Validation failed",
      details: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  // @fastify/rate-limit and other plugins set statusCode for client errors.
  const status = error.statusCode ?? 500;

  if (status >= 500) {
    request.log.error(error);
    captureException(error, { reqId: request.id, url: request.url, method: request.method });
    const message =
      process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;
    return reply.status(status).send({ error: message });
  }

  return reply.status(status).send({ error: error.message });
});

// ─── Auth Decorator ──────────────────────────────────────────────────────────

server.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Unauthorized" });
  }
});

import { prisma } from "@tickerpro/database/client";

server.decorate("requireRole", function (allowedRoles: string[]) {
  return async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const workspaceId = request.query?.workspaceId || request.body?.workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "Missing workspaceId for role verification" });
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: request.user.id, workspaceId } }
    });

    if (!member || !allowedRoles.includes(member.role)) {
      return reply.status(403).send({ error: "Forbidden: Insufficient role permissions" });
    }
  };
});

// ─── Routes ──────────────────────────────────────────────────────────────────

await server.register(healthRoutes, { prefix: "/api/health" });
await server.register(authRoutes, { prefix: "/api/auth" });
await server.register(workspaceRoutes, { prefix: "/api/workspaces" });
await server.register(contactRoutes, { prefix: "/api/contacts" });
await server.register(conversationRoutes, { prefix: "/api/conversations" });
await server.register(messageRoutes, { prefix: "/api/messages" });
await server.register(broadcastRoutes, { prefix: "/api/broadcasts" });
await server.register(webhookRoutes, { prefix: "/api/webhooks" });
await server.register(chatbotRoutes, { prefix: "/api/chatbots" });
await server.register(integrationRoutes, { prefix: "/api/integrations" });
await server.register(publicApiRoutes, { prefix: "/api/v1/public" });
await server.register(knowledgeRoutes, { prefix: "/api/knowledge" });
await server.register(paymentRoutes, { prefix: "/api/payments" });
await server.register(analyticsRoutes, { prefix: "/api/analytics" });
await server.register(adsRoutes, { prefix: "/api/ads" });
await server.register(commerceRoutes, { prefix: "/api/commerce" });
await server.register(catalogRoutes, { prefix: "/api/catalog" });
await server.register(templateRoutes, { prefix: "/api/templates" });
await server.register(flowRoutes, { prefix: "/api/flows" });
await server.register(dripRoutes, { prefix: "/api/drips" });
await server.register(copilotRoutes, { prefix: "/api/copilot" });
await server.register(auditRoutes, { prefix: "/api/audit" });
await server.register(webhookManagementRoutes, { prefix: "/api/outbound-webhooks" });
await server.register(segmentRoutes, { prefix: "/api/segments" });
await server.register(billingRoutes, { prefix: "/api/billing" });
await server.register(wsRoutes);

import { startDripEngine, stopDripEngine } from "./services/drip-engine.js";
import { closeQueue } from "./lib/queue.js";

// ─── Graceful shutdown ───────────────────────────────────────────────────────
// On SIGTERM/SIGINT (e.g. an ECS/K8s rolling deploy) stop accepting new work,
// drain in-flight requests, and close DB/Redis connections so nothing leaks.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.log.info(`[shutdown] received ${signal}, closing gracefully…`);

  // Fail a slow shutdown rather than hang the orchestrator forever.
  const forceExit = setTimeout(() => {
    server.log.error("[shutdown] timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    stopDripEngine();
    await server.close(); // stops listening + waits for in-flight requests
    await closeQueue();
    await prisma.$disconnect();
    clearTimeout(forceExit);
    server.log.info("[shutdown] complete");
    process.exit(0);
  } catch (err) {
    server.log.error(err, "[shutdown] error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ─── Start ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  // Initialize error tracking (no-op unless SENTRY_DSN + @sentry/node present)
  await initObservability();

  // Start background engines
  startDripEngine(60000); // 1 minute interval

  await server.listen({ port, host });
  server.log.info(`🚀 TickerPro API running on http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

export default server;

