import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { enqueue, registerHandler } from "../lib/queue.js";
import { executeBroadcast } from "../services/broadcast-engine.js";

export async function broadcastRoutes(app: FastifyInstance) {
  // Register the inline handler so broadcasts still send when Redis isn't
  // configured (dev). With Redis, the separate worker process consumes instead.
  registerHandler("broadcast", (data) => executeBroadcast(data.broadcastId));

  // ── List broadcasts ───────────────────────────────────────────────
  app.get(
    "/",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
      });
      if (!membership) return { broadcasts: [], total: 0 };

      const [broadcasts, total] = await Promise.all([
        prisma.broadcast.findMany({
          where: { workspaceId: membership.workspaceId },
          include: { whatsappNumber: { select: { phoneNumber: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.broadcast.count({ where: { workspaceId: membership.workspaceId } }),
      ]);

      return { broadcasts, total };
    }
  );

  // ── Get single broadcast ──────────────────────────────────────────
  app.get(
    "/:id",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const broadcast = await prisma.broadcast.findUnique({
        where: { id },
        include: { whatsappNumber: true },
      });
      if (!broadcast) return { error: "Broadcast not found" };
      return broadcast;
    }
  );

  // ── Create broadcast ──────────────────────────────────────────────
  app.post(
    "/",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const body = request.body as {
        name: string;
        templateName?: string;
        scheduledAt?: string;
        segmentId?: string;
      };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
      });
      if (!membership) return reply.status(403).send({ error: "No workspace" });

      // Get Segment if provided
      let segmentRules: any = null;
      let segmentMatchType: string = "ALL";
      if (body.segmentId) {
        const segment = await prisma.segment.findUnique({
          where: { id: body.segmentId }
        });
        if (segment) {
          segmentRules = segment.rules;
          segmentMatchType = segment.matchType;
        }
      }

      // We'll calculate recipients dynamically at send time, but for the UI let's estimate or just set 0
      // In a real system, we'd query here. For now, we'll let the engine do it.
      const totalRecipients = body.segmentId ? 0 : await prisma.contact.count({
        where: { workspaceId: membership.workspaceId },
      });

      const broadcast = await prisma.broadcast.create({
        data: {
          workspaceId: membership.workspaceId,
          templateName: body.templateName || null,
          name: body.name,
          status: body.scheduledAt ? "SCHEDULED" : "SENDING",
          totalRecipients,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          // Omit rather than pass null — Prisma's Json fields reject a bare null.
          ...(body.segmentId ? { audienceFilter: { segmentId: body.segmentId } } : {}),
        },
      });

      // Dispatch: send now, or schedule for the requested time.
      const delayMs = body.scheduledAt
        ? Math.max(0, new Date(body.scheduledAt).getTime() - Date.now())
        : 0;
      await enqueue("broadcast", { broadcastId: broadcast.id }, { delayMs });

      // Log audit trail
      await prisma.auditLog.create({
        data: {
          workspaceId: membership.workspaceId,
          performedBy: userId,
          action: "BROADCAST_CREATED",
          entityType: "Broadcast",
          entityId: broadcast.id,
          metadata: { name: body.name, recipients: totalRecipients },
        },
      });

      return reply.status(201).send(broadcast);
    }
  );

  // ── Cancel broadcast ──────────────────────────────────────────────
  app.post(
    "/:id/cancel",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { id } = request.params as { id: string };

      // Mark cancelled; executeBroadcast no-ops on CANCELLED if a job still fires.
      const broadcast = await prisma.broadcast.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { success: true, broadcast };
    }
  );
}
