import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";

export async function segmentRoutes(app: FastifyInstance) {
  // ── List Segments ──────────────────────────────────────────────────
  app.get(
    "/",
    { onRequest: [(app as any).requireRole(["VIEWER", "AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"])] },
    async (request) => {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return { error: "workspaceId is required" };

      const segments = await prisma.segment.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      });

      return { segments };
    }
  );

  // ── Create Segment ─────────────────────────────────────────────────
  app.post(
    "/",
    { onRequest: [(app as any).requireRole(["MANAGER", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.query as { workspaceId: string };
      const data = request.body as { name: string; description?: string; rules: any; matchType: string };

      if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
      if (!data.name || !data.rules) return reply.status(400).send({ error: "name and rules are required" });

      const segment = await prisma.segment.create({
        data: {
          name: data.name,
          description: data.description,
          rules: data.rules,
          matchType: data.matchType || "ALL",
          workspaceId,
        },
      });

      return reply.status(201).send({ segment });
    }
  );

  // ── Delete Segment ─────────────────────────────────────────────────
  app.delete(
    "/:id",
    { onRequest: [(app as any).requireRole(["MANAGER", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { workspaceId } = request.query as { workspaceId: string };

      if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

      try {
        await prisma.segment.delete({
          where: { id, workspaceId },
        });
        return { success: true };
      } catch (err) {
        return reply.status(404).send({ error: "Segment not found" });
      }
    }
  );
}
