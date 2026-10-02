import { prisma } from "@tickerpro/database/client";
import crypto from "crypto";

export async function triggerOutboundWebhook(workspaceId: string, event: string, payload: any) {
  const webhooks = await prisma.outboundWebhook.findMany({
    where: { workspaceId, isActive: true },
  });

  if (webhooks.length === 0) return;

  const promises = webhooks.map(async (webhook) => {
    // Check if webhook is subscribed to this event
    const subscribedEvents = webhook.events as string[];
    if (!subscribedEvents.includes(event) && !subscribedEvents.includes("*")) {
      return;
    }

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (webhook.secret) {
      const signature = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");
      headers["X-TickerPro-Signature"] = `sha256=${signature}`;
    }

    try {
      await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
      });
    } catch (err) {
      console.error(`[Webhook] Failed to deliver ${event} to ${webhook.url}`);
    }
  });

  await Promise.all(promises);
}
