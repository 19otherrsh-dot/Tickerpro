import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import crypto from "crypto";
import { logAuditEvent } from "./audit.js";

interface BaseQuery {
  workspaceId: string;
}

export async function webhookManagementRoutes(fastify: FastifyInstance) {
  // ─── List Outbound Webhooks ──────────────────────────────────────────────────
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["ADMIN", "SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const webhooks = await prisma.outboundWebhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return { webhooks };
  });

  // ─── Create Webhook ──────────────────────────────────────────────────────────
  fastify.post("/", { preValidation: [(fastify as any).requireRole(["ADMIN", "SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{
      Querystring: BaseQuery;
      Body: { url: string; events: string[]; secret?: string }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { url, events, secret } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!url) return reply.status(400).send({ error: "url is required" });

    const webhook = await prisma.outboundWebhook.create({
      data: {
        workspaceId,
        url,
        events: events || ["*"],
        secret: secret || crypto.randomBytes(32).toString("hex"),
        isActive: true,
      },
    });

    await logAuditEvent(workspaceId, "WEBHOOK_CREATED", (request as any).user?.id, { url, events });

    return { webhook };
  });

  // ─── Toggle Active / Pause ───────────────────────────────────────────────────
  fastify.patch("/:id/toggle", { preValidation: [(fastify as any).requireRole(["ADMIN", "SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    const existing = await prisma.outboundWebhook.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Webhook not found" });

    const updated = await prisma.outboundWebhook.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return { webhook: updated };
  });

  // ─── Delete Webhook ──────────────────────────────────────────────────────────
  fastify.delete("/:id", { preValidation: [(fastify as any).requireRole(["ADMIN", "SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    await prisma.outboundWebhook.deleteMany({ where: { id, workspaceId } });

    await logAuditEvent(workspaceId, "WEBHOOK_DELETED", (request as any).user?.id, { webhookId: id });

    return { success: true };
  });

  // ─── Test Webhook (send a ping) ──────────────────────────────────────────────
  fastify.post("/:id/test", { preValidation: [(fastify as any).requireRole(["ADMIN", "SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    const webhook = await prisma.outboundWebhook.findFirst({ where: { id, workspaceId } });
    if (!webhook) return reply.status(404).send({ error: "Webhook not found" });

    const testPayload = JSON.stringify({
      event: "test.ping",
      payload: { message: "Hello from TickerPro! Your webhook is working." },
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhook.secret) {
      const signature = crypto.createHmac("sha256", webhook.secret).update(testPayload).digest("hex");
      headers["X-TickerPro-Signature"] = `sha256=${signature}`;
    }

    try {
      const res = await fetch(webhook.url, { method: "POST", headers, body: testPayload });
      return { success: true, statusCode: res.status };
    } catch (err: any) {
      return reply.status(502).send({ error: `Failed to reach ${webhook.url}: ${err.message}` });
    }
  });
}
