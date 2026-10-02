import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";

interface BaseQuery {
  workspaceId: string;
}

export async function auditRoutes(fastify: FastifyInstance) {
  // ─── List Audit Logs ─────────────────────────────────────────────────────────
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{
      Querystring: BaseQuery & { action?: string; page?: string; limit?: string }
    }>,
    reply
  ) => {
    const { workspaceId, action, page = "1", limit = "50" } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const where: any = { workspaceId };
    if (action) where.action = action;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { entries, total };
  });

  // ─── Get Distinct Actions (for filter dropdown) ──────────────────────────────
  fastify.get("/actions", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const raw = await prisma.auditLog.findMany({
      where: { workspaceId },
      distinct: ["action"],
      select: { action: true },
    });

    return { actions: raw.map(r => r.action) };
  });
}

// ─── Helper: log an audit event from anywhere in the codebase ──────────────
export async function logAuditEvent(
  workspaceId: string,
  action: string,
  userId?: string | null,
  details?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        action,
        entityType: "SYSTEM",
        entityId: "SYSTEM",
        performedBy: userId || "SYSTEM",
        metadata: details || null,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit entry:", err);
  }
}
