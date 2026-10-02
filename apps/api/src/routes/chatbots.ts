import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { z } from "zod";

export async function chatbotRoutes(app: FastifyInstance) {
  // ── Types & Schemas ──────────────────────────────────────────────────────────

  const flowSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    isActive: z.boolean().default(false),
    triggerType: z.enum(["KEYWORD", "FIRST_MESSAGE", "EVENT", "WEBHOOK", "AD_CLICK"]).default("KEYWORD"),
    triggerValue: z.string().optional().nullable(),
    flowData: z.any().default({ nodes: [], edges: [] }),
    language: z.string().default("en"),
  });

  // ── Routes ───────────────────────────────────────────────────────────────────

  // Get all chatbot flows for a workspace
  app.get<{ Querystring: { workspaceId: string } }>(
    "/",
    { preValidation: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.query;

      const flows = await prisma.chatbotFlow.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
      });

      return reply.send({ flows });
    }
  );

  // Get a specific chatbot flow
  app.get<{ Params: { id: string }; Querystring: { workspaceId: string } }>(
    "/:id",
    { preValidation: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params;
      const { workspaceId } = request.query;

      const flow = await prisma.chatbotFlow.findFirst({
        where: { id, workspaceId },
      });

      if (!flow) {
        return reply.status(404).send({ error: "Flow not found" });
      }

      return reply.send({ flow });
    }
  );

  // Create a new chatbot flow
  app.post<{ Querystring: { workspaceId: string }; Body: z.infer<typeof flowSchema> }>(
    "/",
    { preValidation: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.query;
      const data = flowSchema.parse(request.body);

      const flow = await prisma.chatbotFlow.create({
        data: {
          ...data,
          workspaceId,
        },
      });

      return reply.status(201).send({ flow });
    }
  );

  // Update a chatbot flow
  app.put<{ Params: { id: string }; Querystring: { workspaceId: string }; Body: z.infer<typeof flowSchema> }>(
    "/:id",
    { preValidation: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params;
      const { workspaceId } = request.query;
      const data = flowSchema.parse(request.body);

      const existingFlow = await prisma.chatbotFlow.findFirst({
        where: { id, workspaceId },
      });

      if (!existingFlow) {
        return reply.status(404).send({ error: "Flow not found" });
      }

      const flow = await prisma.chatbotFlow.update({
        where: { id },
        data: { ...data },
      });

      return reply.send({ flow });
    }
  );

  // Delete a chatbot flow
  app.delete<{ Params: { id: string }; Querystring: { workspaceId: string } }>(
    "/:id",
    { preValidation: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params;
      const { workspaceId } = request.query;

      const existingFlow = await prisma.chatbotFlow.findFirst({
        where: { id, workspaceId },
      });

      if (!existingFlow) {
        return reply.status(404).send({ error: "Flow not found" });
      }

      await prisma.chatbotFlow.delete({
        where: { id },
      });

      return reply.send({ success: true });
    }
  );
}
