import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { sendCatalogMessage, sendProductListMessage } from "../services/whatsapp.js";

export async function catalogRoutes(app: FastifyInstance) {
  // ── Send Catalog Message ──────────────────────────────────────────
  app.post(
    "/send",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.user as any || request.query as any;
      const { contactId, bodyText } = request.body as any;

      if (!workspaceId) return reply.status(401).send({ error: "Unauthorized" });

      const waNumber = await prisma.whatsAppNumber.findFirst({
        where: { workspaceId, isActive: true },
      });

      if (!waNumber) {
        return reply.status(400).send({ error: "No active WhatsApp number configured." });
      }

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        return reply.status(404).send({ error: "Contact not found" });
      }

      const result = await sendCatalogMessage(
        {
          accessToken: "mock_token", // Replace with actual config
          phoneNumberId: waNumber.phoneNumber,
          wabaId: "mock_waba_id",
          webhookVerifyToken: "",
        },
        contact.phoneNumber,
        bodyText || "Check out our latest catalog!"
      );

      return { success: result.success, messageId: result.waMessageId };
    }
  );

  // ── Send Product List Message ─────────────────────────────────────
  app.post(
    "/send-product-list",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.user as any || request.query as any;
      const { contactId, catalogId, headerText, bodyText, sections } = request.body as any;

      if (!workspaceId) return reply.status(401).send({ error: "Unauthorized" });

      const waNumber = await prisma.whatsAppNumber.findFirst({
        where: { workspaceId, isActive: true },
      });

      if (!waNumber) {
        return reply.status(400).send({ error: "No active WhatsApp number configured." });
      }

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        return reply.status(404).send({ error: "Contact not found" });
      }

      const result = await sendProductListMessage(
        {
          accessToken: "mock_token", // Replace with actual config
          phoneNumberId: waNumber.phoneNumber,
          wabaId: "mock_waba_id",
          webhookVerifyToken: "",
        },
        contact.phoneNumber,
        catalogId,
        headerText,
        bodyText,
        sections
      );

      return { success: result.success, messageId: result.waMessageId };
    }
  );
}
