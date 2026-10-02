import { FastifyInstance, FastifyRequest } from "fastify";
import { addCredits, getWalletBalance } from "../services/billing-engine.js";
import { logAuditEvent } from "./audit.js";

export async function billingRoutes(fastify: FastifyInstance) {
  // ─── Get Wallet Balance ──────────────────────────────────────────────────────
  fastify.get("/wallet", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Querystring: { workspaceId: string } }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const balance = await getWalletBalance(workspaceId);

    return {
      balance,
      estimatedConversations: {
        userInitiated: Math.floor(balance / 0.005),
        businessInitiated: Math.floor(balance / 0.03),
      },
    };
  });

  // ─── Top Up Wallet ───────────────────────────────────────────────────────────
  fastify.post("/wallet/topup", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{
      Querystring: { workspaceId: string };
      Body: { amount: number };
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { amount } = request.body;
    const { userId } = request.user as { userId: string };

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!amount || amount <= 0) return reply.status(400).send({ error: "Amount must be positive" });

    // In production, this would go through Stripe payment flow first
    const result = await addCredits(workspaceId, amount, userId);

    await logAuditEvent(workspaceId, "BILLING_TOPUP", userId, { amount, newBalance: result.newBalance });

    return result;
  });

  // ─── Usage Summary ───────────────────────────────────────────────────────────
  fastify.get("/usage", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{
      Querystring: { workspaceId: string; period?: string };
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    // In production, aggregate from ClickHouse or audit logs
    return {
      period: "current_month",
      conversations: {
        userInitiated: 342,
        businessInitiated: 1205,
        service: 89,
      },
      totalSpend: 42.39,
      topTemplates: [
        { name: "order_confirmation", sends: 580 },
        { name: "abandoned_cart_reminder", sends: 420 },
        { name: "welcome_message", sends: 205 },
      ],
    };
  });

  // ─── Trigger Reconciliation ──────────────────────────────────────────────────
  fastify.post("/reconcile", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{
      Querystring: { workspaceId: string };
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const { reconcileBilling } = await import("../services/billing-engine.js");
    const result = await reconcileBilling(workspaceId);
    
    if (!result.success) {
      return reply.status(400).send({ error: result.reason || "Reconciliation failed" });
    }

    return result;
  });
}
