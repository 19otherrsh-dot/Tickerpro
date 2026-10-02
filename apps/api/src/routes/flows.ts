import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";

interface BaseQuery {
  workspaceId: string;
}

export async function flowRoutes(fastify: FastifyInstance) {
  // ─── List Flows ──────────────────────────────────────────────────────────────
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (request: FastifyRequest<{ Querystring: BaseQuery }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const flows = await prisma.whatsAppFlow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });

    return { flows };
  });

  // ─── Create Flow ─────────────────────────────────────────────────────────────
  fastify.post("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Querystring: BaseQuery;
      Body: { name: string; screens: any }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { name, screens } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const flow = await prisma.whatsAppFlow.create({
      data: {
        workspaceId,
        name,
        screens,
        status: "DRAFT"
      }
    });

    return { flow };
  });

  // ─── Publish Flow to Meta ────────────────────────────────────────────────────
  fastify.post("/:id/publish", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: BaseQuery;
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const flow = await prisma.whatsAppFlow.findUnique({
      where: { id, workspaceId }
    });

    if (!flow) return reply.status(404).send({ error: "Flow not found" });

    // Mock publish to Meta API
    // Normally we'd POST to /<WABA_ID>/flows with the JSON definition
    await prisma.whatsAppFlow.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        metaFlowId: `flow_${Math.random().toString(36).substring(2, 9)}`
      }
    });

    return { success: true };
  });
}
