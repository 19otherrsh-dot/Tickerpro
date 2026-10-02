import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { MetaCommerceClient } from "../lib/meta-commerce.js";

export async function commerceRoutes(app: FastifyInstance) {
  // ── Get Orders ───────────────────────────────────────────────────
  app.get(
    "/orders",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return { error: "workspaceId is required" };

      const orders = await prisma.ecomOrder.findMany({
        where: { workspaceId },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return { orders };
    }
  );

  // ── Get Abandoned Carts ──────────────────────────────────────────
  app.get(
    "/carts",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return { error: "workspaceId is required" };

      const carts = await prisma.ecomCart.findMany({
        where: { workspaceId },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return { carts };
    }
  );

  // ── Shopify Webhook Ingestion ────────────────────────────────────
  app.post("/webhooks/shopify", async (request, reply) => {
    const payload = request.body as any;
    const topic = request.headers["x-shopify-topic"] as string;
    const workspaceId = request.headers["x-tickerpro-workspace-id"] as string;

    if (!workspaceId || !topic) {
      return reply.status(400).send({ error: "Missing workspaceId or topic" });
    }

    try {
      if (topic === "carts/update") {
        const cart = await prisma.ecomCart.upsert({
          where: {
            workspaceId_externalCartId: { workspaceId, externalCartId: payload.id.toString() }
          },
          create: {
            workspaceId,
            externalCartId: payload.id.toString(),
            totalAmount: parseFloat(payload.total_price) || 0,
            currency: payload.currency || "USD",
            checkoutUrl: payload.checkout_url || "",
            items: payload.line_items || [],
          },
          update: {
            totalAmount: parseFloat(payload.total_price) || 0,
            items: payload.line_items || [],
          }
        });

        // Auto-Enroll in Abandoned Cart Drip Campaign
        const campaigns = await prisma.dripCampaign.findMany({
          where: { workspaceId, status: "ACTIVE", triggerType: "ABANDONED_CART" }
        });

        let contactId = null;
        if (payload.customer?.phone) {
          const phone = payload.customer.phone.replace(/\D/g, "");
          const contact = await prisma.contact.findFirst({ where: { workspaceId, phoneNumber: phone } });
          if (contact) contactId = contact.id;
        }

        if (contactId && campaigns.length > 0) {
          for (const campaign of campaigns) {
            await prisma.dripEnrollment.upsert({
              where: { campaignId_contactId: { campaignId: campaign.id, contactId } },
              create: {
                campaignId: campaign.id,
                contactId,
                currentStep: 0,
                nextRunAt: new Date(Date.now() + 15 * 60000), // 15 min delay
                status: "ACTIVE"
              },
              update: {}
            });
            console.log(`[Commerce] Auto-enrolled contact ${contactId} in Abandoned Cart sequence`);
          }
        }
      } else if (topic === "orders/create") {
        await prisma.ecomOrder.upsert({
          where: {
            workspaceId_externalOrderId: { workspaceId, externalOrderId: payload.id.toString() }
          },
          create: {
            workspaceId,
            externalOrderId: payload.id.toString(),
            totalAmount: parseFloat(payload.total_price) || 0,
            currency: payload.currency || "USD",
            status: "PAID",
            orderUrl: payload.order_status_url || "",
            items: payload.line_items || [],
          },
          update: {
            status: "PAID"
          }
        });

        // Trigger Ad Attribution if contact has phone number
        if (payload.customer?.phone) {
          const phone = payload.customer.phone.replace(/\D/g, "");
          const { attributeRevenueToConversation } = await import("../services/attribution.js");
          await attributeRevenueToConversation(workspaceId, phone, parseFloat(payload.total_price) || 0);
        }
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error("Shopify webhook error:", err);
      return reply.status(500).send({ error: "Internal error" });
    }
  });

  // ── Sync Local Catalog to Meta ──────────────────────────────────────
  app.post(
    "/sync-catalog",
    { onRequest: [(app as any).requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { catalogName } = request.body as { catalogName: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true }
      });

      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const workspace = membership.workspace;
      if (!workspace.metaBusinessId) {
        return reply.status(400).send({ error: "Meta Business ID not configured for this workspace." });
      }

      // Mock System Access Token for now (In real app, this comes from an Integration record)
      const systemAccessToken = process.env.META_SYSTEM_TOKEN || "mock_access_token";
      const metaClient = new MetaCommerceClient(systemAccessToken, workspace.metaBusinessId);

      try {
        // 1. Create the catalog in Meta
        const metaCatalogId = await metaClient.createCatalog(catalogName || `Catalog - ${workspace.name}`);

        // 2. Save it locally
        const catalog = await prisma.metaCatalog.create({
          data: {
            metaCatalogId,
            name: catalogName || `Catalog - ${workspace.name}`,
            workspaceId: workspace.id
          }
        });

        // 3. (Mock step) If we had an internal product DB or Shopify sync, we would fetch products and batch upload here.
        // For demonstration, let's pretend we uploaded 0 products initially.
        
        return reply.send({ success: true, catalogId: catalog.id, metaCatalogId });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // ── Get Catalogs ───────────────────────────────────────────────────
  app.get(
    "/catalogs",
    { onRequest: [(app as any).requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId }
      });

      if (!membership) return { catalogs: [] };

      const catalogs = await prisma.metaCatalog.findMany({
        where: { workspaceId: membership.workspaceId },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      return { catalogs };
    }
  );
}
