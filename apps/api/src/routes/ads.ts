import { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";

export async function adsRoutes(app: FastifyInstance) {
  // ── Create Click-to-WhatsApp Ad ───────────────────────────────────────────────
  app.post(
    "/create",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

      const { name, budget, audience, copy } = request.body as any;
      if (!name || !budget) return reply.status(400).send({ error: "Missing ad config details" });

      // Mock creating an ad via Meta Graph API
      // In production: POST https://graph.facebook.com/v19.0/{ad_account_id}/adcampaigns
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockAdId = `ad_${Date.now()}`;
      
      // Save ad metadata to DB (this would ideally have its own table, saving to generic audit for now or we just mock)
      console.log(`[Ads Manager] Created Click-to-WhatsApp Ad ${name} (ID: ${mockAdId}) for workspace ${workspaceId}.`);
      
      return { 
        success: true, 
        ad: {
          id: mockAdId,
          name,
          budget,
          audience,
          copy,
          status: "ACTIVE"
        }
      };
    }
  );

  // ── Get Ad Analytics ───────────────────────────────────────────────
  app.get(
    "/analytics",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

      const { getAdROAS } = await import("../services/clickhouse.js");
      const roasData = await getAdROAS(workspaceId) as Array<{ adId: string, totalRevenue: number, conversions: number }>;

      // In a real app we would fetch the active Ads from the Meta API or local DB
      // For demo, we will create a mock list of ads and merge the ClickHouse ROAS data
      const mockAds = [
        { id: "ad_summer_sale", name: "Summer Sale 2024", budget: 500, status: "ACTIVE" },
        { id: "ad_retargeting", name: "Cart Abandonment Retargeting", budget: 150, status: "ACTIVE" },
      ];

      const analytics = mockAds.map(ad => {
        const data = roasData.find(r => r.adId === ad.id);
        // Add some mock baseline revenue so the dashboard isn't completely empty initially
        const revenue = data ? Number(data.totalRevenue) : (ad.id === "ad_summer_sale" ? 1250 : 300);
        const roas = ((revenue / ad.budget) * 100).toFixed(0);
        return {
          ...ad,
          revenue,
          conversions: data ? Number(data.conversions) : (ad.id === "ad_summer_sale" ? 25 : 8),
          roas,
        };
      });

      return { analytics };
    }
  );
}
