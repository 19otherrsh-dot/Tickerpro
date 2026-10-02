import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";

interface BaseQuery {
  workspaceId: string;
}

export async function templateRoutes(fastify: FastifyInstance) {
  // ─── List Templates from Meta ────────────────────────────────────────────────
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (request: FastifyRequest<{ Querystring: BaseQuery }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    // Fetch integration for waba
    const waNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId, isActive: true },
    });

    if (!waNumber) return reply.status(400).send({ error: "No active WhatsApp number found" });

    const accessToken = process.env.META_ACCESS_TOKEN; // Or fetch from integrations

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${waNumber.wabaId}/message_templates`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      return { templates: data.data || [] };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch templates from Meta" });
    }
  });

  // ─── Create Template in Meta ─────────────────────────────────────────────────
  fastify.post("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Querystring: BaseQuery;
      Body: { name: string; category: string; components: any[]; language: string }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { name, category, components, language } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const waNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId, isActive: true },
    });

    if (!waNumber) return reply.status(400).send({ error: "No active WhatsApp number found" });

    const accessToken = process.env.META_ACCESS_TOKEN;

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${waNumber.wabaId}/message_templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          category,
          components,
          language,
        }),
      });

      const data = await res.json();
      if (data.error) {
        return reply.status(400).send({ error: data.error.message });
      }

      return { success: true, id: data.id };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to create template" });
    }
  });
}
