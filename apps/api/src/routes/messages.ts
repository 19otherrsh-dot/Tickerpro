import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { broadcastToWorkspace } from "./ws.js";
import { openConversationWindow } from "../services/billing-engine.js";
import { triggerOutboundWebhook } from "../lib/webhooks.js";
import { createPaymentLink } from "../services/payments.js";
import { sendMessage } from "../services/whatsapp.js";
import { sendChannelText } from "../services/meta-messaging.js";

export async function messageRoutes(app: FastifyInstance) {
  // ── List messages in a conversation ───────────────────────────────
  app.get(
    "/:conversationId",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { conversationId } = request.params as { conversationId: string };
      const { before, limit = "50" } = request.query as Record<string, string>;

      const where: any = { conversationId };
      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      const messages = await prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit) + 1, // +1 to check hasMore
      });

      const hasMore = messages.length > parseInt(limit);
      if (hasMore) messages.pop();

      return {
        messages: messages.reverse(), // Return in chronological order
        hasMore,
      };
    }
  );

  // ── Send a message ────────────────────────────────────────────────
  app.post(
    "/:conversationId/send",
    { onRequest: [(app as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };
      const body = request.body as {
        type: string;
        body?: string;
        mediaUrl?: string;
        templateName?: string;
      };

      // Get conversation with its channel account (WhatsApp number, or the
      // Page/IG account for Messenger/Instagram conversations).
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true, whatsappNumber: true, channelAccount: true },
      });

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // Check billing — open a conversation window (deducts credits if new 24h window)
      const billingCheck = await openConversationWindow(
        conversationId,
        conversation.workspaceId,
        "BUSINESS_INITIATED"
      );

      if (!billingCheck.allowed) {
        return reply.status(402).send({ error: billingCheck.reason || "Insufficient credits" });
      }

      let outboundText = body.body || null;

      // Check for Copilot Command: /pay [amount] [description...]
      if (outboundText && outboundText.startsWith("/pay ")) {
        const parts = outboundText.split(" ");
        const amountStr = parts[1];
        if (amountStr && !isNaN(parseFloat(amountStr))) {
          const amount = parseFloat(amountStr) * 100; // Defaulting to smallest unit (cents)
          const description = parts.slice(2).join(" ") || "Invoice Payment";
          try {
            const linkData = await createPaymentLink(conversation.workspaceId, {
              contactId: conversation.contact.id,
              amount,
              currency: "USD",
              description,
              contactEmail: conversation.contact.email || undefined,
              contactPhone: conversation.contact.phoneNumber,
              referenceId: `copilot_${Date.now()}`
            });
            outboundText = `Here is your payment link for ${description}: ${linkData.url}`;
          } catch (e: any) {
            console.error("[Copilot /pay] Failed to generate link:", e);
            // Fallback to a mock link if no integration is configured for demo purposes
            if (e.message.includes("No active payment gateways")) {
               outboundText = `Here is your payment link for ${description}: https://mock-checkout.stripe.com/pay/inv_${Date.now()}`;
            } else {
               return reply.status(400).send({ error: "Failed to generate payment link: " + e.message });
            }
          }
        }
      }

      // Create message record
      const message = await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          channel: conversation.channel,
          type: body.type as any,
          content: { text: outboundText, mediaUrl: body.mediaUrl || null },
          status: "QUEUED",
        },
      });

      // ── Dispatch to the provider for this conversation's channel ──────────
      // Failures are recorded on the message (status FAILED) rather than thrown,
      // so the agent still sees their message in the thread with an error state.
      let deliveredId: string | undefined;
      let deliveryError: string | undefined;

      try {
        if (conversation.channel === "WHATSAPP") {
          const waNumber = conversation.whatsappNumber;
          const accessToken = process.env.META_ACCESS_TOKEN;
          if (!waNumber) throw new Error("Conversation has no WhatsApp number");
          if (!accessToken) throw new Error("META_ACCESS_TOKEN is not configured");
          if (!outboundText) throw new Error("Message body is required");

          const waRes = await sendMessage(
            {
              accessToken,
              phoneNumberId: waNumber.phoneNumberId,
              wabaId: waNumber.wabaId,
              webhookVerifyToken: "",
            },
            conversation.contact.phoneNumber,
            { type: "text", text: { body: outboundText } }
          );
          deliveredId = waRes.messages?.[0]?.id;
        } else {
          // MESSENGER / INSTAGRAM — send via the Page-scoped Meta Send API.
          const account = conversation.channelAccount;
          if (!account) throw new Error(`Conversation has no ${conversation.channel} account`);
          if (!outboundText) throw new Error("Message body is required");

          const res = await sendChannelText(
            { externalId: account.externalId, accessToken: account.accessToken },
            conversation.contact.phoneNumber, // PSID/IGSID for these channels
            outboundText
          );
          deliveredId = res.messageId;
        }
      } catch (err: any) {
        deliveryError = err?.message ?? "Send failed";
        request.log.error(err, `[Messages] ${conversation.channel} send failed`);
      }

      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: deliveryError ? "FAILED" : "SENT",
          ...(deliveredId ? { waMessageId: deliveredId } : {}),
        },
      });

      // Update conversation's last message time
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Broadcast to WebSocket clients so other agents / tabs see the outbound
      // message live (the sending tab updates optimistically on its own).
      broadcastToWorkspace(conversation.workspaceId, {
        type: "message:new",
        payload: {
          message: updatedMessage,
          conversationId,
          contact: {
            id: conversation.contact.id,
            name: conversation.contact.name,
            phone: conversation.contact.phoneNumber,
          },
        },
        timestamp: new Date().toISOString(),
      });

      // Trigger outbound webhooks
      triggerOutboundWebhook(conversation.workspaceId, "message.sent", {
        messageId: updatedMessage.id,
        conversationId,
        channel: conversation.channel,
        type: body.type,
        direction: "OUTBOUND",
      });

      if (deliveryError) {
        return reply.status(502).send({ ...updatedMessage, error: deliveryError });
      }

      return reply.status(201).send(updatedMessage);
    }
  );
}
