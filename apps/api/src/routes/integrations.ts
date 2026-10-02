import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { IntegrationType } from "@prisma/client";
import { listCrmConnectors, syncContactToCrm } from "../services/integrations/crm.js";

interface BaseQuery {
  workspaceId: string;
}

export async function integrationRoutes(fastify: FastifyInstance) {
  // ─── CRM Connectors: list available + configured status ────────────────────
  fastify.get("/crm/connectors", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (request: FastifyRequest<{ Querystring: BaseQuery }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    return { connectors: listCrmConnectors() };
  });

  // ─── CRM Connectors: sync a contact to a chosen CRM ────────────────────────
  fastify.post("/crm/:crmId/sync", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { crmId: string }; Querystring: BaseQuery; Body: { contactId: string } }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { crmId } = request.params;
    const { contactId } = request.body ?? ({} as { contactId: string });
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!contactId) return reply.status(400).send({ error: "contactId is required" });

    const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    const result = await syncContactToCrm(crmId, workspaceId, {
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      email: contact.email,
    });
    if (!result.success) return reply.status(result.skipped ? 409 : 502).send(result);
    return result;
  });
  // â”€â”€â”€ List Integrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (request: FastifyRequest<{ Querystring: BaseQuery }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const integrations = await prisma.integration.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });

    return { integrations };
  });

  // â”€â”€â”€ Get Specific Integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.get("/:type", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { type: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { type } = request.params;
    
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const integrationType = type.toUpperCase() as IntegrationType;
    if (!Object.values(IntegrationType).includes(integrationType)) {
      return reply.status(400).send({ error: "Invalid integration type" });
    }

    const integration = await prisma.integration.findUnique({
      where: {
        workspaceId_type: {
          workspaceId,
          type: integrationType,
        },
      },
    });

    if (!integration) return reply.status(404).send({ error: "Integration not found" });

    return { integration };
  });

  // â”€â”€â”€ Save / Update Integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.post("/", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Querystring: BaseQuery;
      Body: { type: string; config: any; isActive: boolean }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { type, config, isActive } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const integrationType = type.toUpperCase() as IntegrationType;
    if (!Object.values(IntegrationType).includes(integrationType)) {
      return reply.status(400).send({ error: "Invalid integration type" });
    }

    let configToSave = { ...config };

    // For MVP, we store the API key in plain text within the config JSON
    // In a production environment, this should be symmetrically encrypted.

    const integration = await prisma.integration.upsert({
      where: {
        workspaceId_type: {
          workspaceId,
          type: integrationType,
        },
      },
      update: {
        config: configToSave,
        isActive,
      },
      create: {
        workspaceId,
        type: integrationType,
        config: configToSave,
        isActive,
      },
    });

    return { integration };
  });

  // â”€â”€â”€ Delete Integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.delete("/:id", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    await prisma.integration.deleteMany({
      where: {
        id,
        workspaceId,
      },
    });

    return { success: true };
  });

  // ─── Meta Embedded Signup OAuth Callback ─────────────────────────────────────
  fastify.post("/meta/oauth", { preValidation: [(fastify as any).requireRole(["ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Querystring: BaseQuery;
      Body: { code: string; redirectUri: string; wabaId?: string; phoneNumberId?: string; phoneNumber?: string; displayName?: string }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { code, redirectUri, wabaId, phoneNumberId, phoneNumber, displayName } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!code) return reply.status(400).send({ error: "OAuth code is required" });

    // Exchange the code for a token from Meta
    // POST https://graph.facebook.com/v19.0/oauth/access_token
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;

    if (!clientId || !clientSecret) {
      return reply.status(500).send({ error: "Meta App credentials not configured on the server." });
    }

    try {
      const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&redirect_uri=${redirectUri}`);
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        fastify.log.error("Meta OAuth Error", tokenData.error);
        return reply.status(400).send({ error: tokenData.error.message });
      }

      // Save token to integrations
      const integration = await prisma.integration.upsert({
        where: { workspaceId_type: { workspaceId, type: IntegrationType.META } },
        update: {
          config: { accessToken: tokenData.access_token },
          isActive: true
        },
        create: {
          workspaceId,
          type: IntegrationType.META,
          config: { accessToken: tokenData.access_token },
          isActive: true
        }
      });

      // If Embedded Signup callback provided the IDs, link the WhatsApp Number automatically
      if (wabaId && phoneNumberId && phoneNumber) {
        await prisma.whatsAppNumber.upsert({
          where: { phoneNumberId },
          update: {
            workspaceId,
            wabaId,
            phoneNumber,
            displayName: displayName || "WhatsApp Business Account",
            isActive: true,
          },
          create: {
            workspaceId,
            phoneNumberId,
            wabaId,
            phoneNumber,
            displayName: displayName || "WhatsApp Business Account",
            isActive: true,
          }
        });
        
        // Ensure Workspace has metaBusinessId
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { metaBusinessId: wabaId }
        });
      }

      return { success: true, integration };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to exchange Meta OAuth code" });
    }
  });
}
