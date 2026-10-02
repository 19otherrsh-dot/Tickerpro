import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";

export async function dripRoutes(app: FastifyInstance) {
  // ── List campaigns ────────────────────────────────────────────────
  app.get(
    "/",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const { workspaceId } = request.query as { workspaceId: string };

      if (!workspaceId) return { campaigns: [] };

      const campaigns = await prisma.dripCampaign.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { enrollments: true } }
        }
      });

      return { campaigns };
    }
  );

  // ── Create campaign ───────────────────────────────────────────────
  app.post(
    "/",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId, name, triggerType, triggerData, steps } = request.body as any;

      if (!workspaceId || !name || !steps) {
        return reply.status(400).send({ error: "Missing required fields" });
      }

      const campaign = await prisma.dripCampaign.create({
        data: {
          workspaceId,
          name,
          triggerType: triggerType || "MANUAL",
          triggerData: triggerData || {},
          steps,
          status: "DRAFT"
        }
      });

      return campaign;
    }
  );

  // ── Update campaign status ────────────────────────────────────────
  app.patch(
    "/:id/status",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const campaign = await prisma.dripCampaign.update({
        where: { id },
        data: { status }
      });

      return campaign;
    }
  );
}
