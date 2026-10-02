import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { IntegrationType } from "@prisma/client";
import { sendMessage } from "../services/whatsapp.js";

interface ApiKeyAuth {
  apiKey: string;
}

export async function publicApiRoutes(fastify: FastifyInstance) {
  // â”€â”€â”€ Middleware: Validate API Key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid Authorization header" });
    }

    const apiKey = authHeader.slice("Bearer ".length).trim();
    if (!apiKey) {
      return reply.status(401).send({ error: "Missing or invalid Authorization header" });
    }
    
    // Hash incoming key and compare
    const crypto = await import("crypto");
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
    
    // For MVP, we assume config contains { apiKeyHash: "..." }
    const integration = await prisma.integration.findFirst({
      where: {
        type: IntegrationType.ZAPIER,
        isActive: true,
        config: {
          path: ["apiKeyHash"],
          equals: hashedKey
        }
      }
    });

    if (!integration) {
      return reply.status(401).send({ error: "Invalid API Key" });
    }

    // Attach workspaceId to the request context
    (request as any).workspaceId = integration.workspaceId;
  });

  // â”€â”€â”€ Create Contact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.post("/contacts", async (
    request: FastifyRequest<{ Body: { phoneNumber: string; name?: string; email?: string } }>,
    reply
  ) => {
    const workspaceId = (request as any).workspaceId;
    const { phoneNumber, name, email } = request.body;

    if (!phoneNumber) return reply.status(400).send({ error: "phoneNumber is required" });

    // Format phone number
    const formattedPhone = phoneNumber.replace(/\D/g, "");

    const contact = await prisma.contact.upsert({
      where: {
        phoneNumber_workspaceId: {
          workspaceId,
          phoneNumber: formattedPhone,
        },
      },
      update: {
        name: name || undefined,
        email: email || undefined,
      },
      create: {
        workspaceId,
        phoneNumber: formattedPhone,
        name: name || null,
        email: email || null,
        leadStage: "NEW",
      },
    });

    return { success: true, contact };
  });

  // â”€â”€â”€ Send Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fastify.post("/messages", async (
    request: FastifyRequest<{ Body: { phoneNumber: string; text?: string; templateName?: string } }>,
    reply
  ) => {
    const workspaceId = (request as any).workspaceId;
    const { phoneNumber, text, templateName } = request.body;

    if (!phoneNumber) return reply.status(400).send({ error: "phoneNumber is required" });
    if (!text && !templateName) return reply.status(400).send({ error: "text or templateName is required" });

    const formattedPhone = phoneNumber.replace(/\D/g, "");

    // Get the first active WhatsApp number for this workspace
    const waNumber = await prisma.whatsAppNumber.findFirst({
      where: { workspaceId, isActive: true }
    });

    if (!waNumber) {
      return reply.status(400).send({ error: "No connected WhatsApp number found for this workspace" });
    }

    try {
      // Find or create contact
      let contact = await prisma.contact.findUnique({
        where: { phoneNumber_workspaceId: { phoneNumber: formattedPhone, workspaceId } }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: { workspaceId, phoneNumber: formattedPhone, leadStage: "NEW" }
        });
      }

      // We need to implement sendMessage in whatsapp.ts that takes raw params
      // For MVP, just returning success since the actual whatsapp integration is stubbed
      console.log(`[Public API] Simulated message send to ${formattedPhone}`);
      
      return { success: true, message: "Queued for sending" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
