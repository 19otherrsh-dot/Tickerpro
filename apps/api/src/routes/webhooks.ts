import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { parseWebhookPayload, markAsRead, sendMessage } from "../services/whatsapp.js";
import { broadcastToWorkspace } from "../routes/ws.js";
import { evaluateFlow } from "../services/flow-engine.js";
import { isWithinBusinessHours } from "../services/business-hours.js";
import { handleShopifyWebhook } from "../services/shopify.js";
import { handleWooCommerceWebhook } from "../services/woocommerce.js";
import { autoAssignConversation } from "../services/auto-assign.js";
import { verifyMetaSignature, verifyShopifySignature, verifyWooCommerceSignature } from "../lib/verify-signature.js";
import { parseChannelWebhook } from "../services/meta-messaging.js";
import { ingestChannelMessages } from "../services/omnichannel.js";
import { matchProductFromImage, addProductToCart } from "../services/product-vision.js";

/**
 * Match a customer-sent photo to the catalog and, on a confident hit, reply with
 * the product and add it to the contact's cart (the "shop by photo" flow).
 */
async function handleProductImage(
  workspaceId: string,
  contactId: string,
  contactPhone: string,
  conversationId: string,
  mediaId: string,
  waConfig: { accessToken: string; phoneNumberId: string; wabaId: string; webhookVerifyToken: string },
  log: { info: (m: string) => void }
): Promise<void> {
  const { matches } = await matchProductFromImage(workspaceId, mediaId, waConfig.accessToken);
  const best = matches[0];
  // Require a reasonably confident match before replying, to avoid noise.
  if (!best || best.score < 0.15) return;

  const { total, currency } = await addProductToCart(workspaceId, contactId, best);
  const body =
    `🛍️ Found it! *${best.name}* — ${best.currency} ${best.price}\n` +
    `I've added it to your cart (total: ${currency} ${total}). Reply *checkout* to complete your order.`;

  const waRes = await sendMessage(waConfig, contactPhone, { type: "text", text: { body } });
  const record = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: { text: body },
      status: "SENT",
      waMessageId: waRes.messages?.[0]?.id,
    },
  });
  broadcastToWorkspace(workspaceId, {
    type: "message:new",
    payload: { message: record, conversationId, contact: { id: contactId, phone: contactPhone } },
    timestamp: new Date().toISOString(),
  });
  log.info(`[Webhook] product image matched "${best.name}" (score ${best.score.toFixed(2)})`);
}

export async function webhookRoutes(app: FastifyInstance) {
  // ── Webhook Verification (Meta sends GET to verify) ───────────────
  app.get("/meta", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "tickerpro-webhook-verify";

    if (mode === "subscribe" && token === verifyToken) {
      app.log.info("[Webhook] Verification successful");
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send("Forbidden");
  });

  // ── Webhook Receiver (Meta sends POST with events) ────────────────
  app.post("/meta", async (request, reply) => {
    // Validate Meta Webhook Signature over the RAW request body (Meta signs the
    // exact bytes it sent — a re-serialized object would never match).
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
    const sig = verifyMetaSignature(rawBody, signature);
    if (!sig.valid) {
      app.log.warn(`[Webhook] Rejected Meta webhook: ${sig.reason ?? "invalid signature"}`);
      return reply.status(403).send("Invalid signature");
    }

    const body = request.body as any;

    // Always respond 200 immediately (Meta requirement)
    reply.status(200).send("EVENT_RECEIVED");

    // ── Messenger / Instagram Direct ────────────────────────────────
    // Meta sends these to the same webhook, distinguished by `object`
    // ("page" = Messenger, "instagram" = Instagram). WhatsApp uses
    // "whatsapp_business_account" and falls through to the block below.
    if (body?.object === "page" || body?.object === "instagram") {
      const { channel, messages: channelMessages } = parseChannelWebhook(body);
      if (channel && channelMessages.length > 0) {
        ingestChannelMessages(channel, channelMessages, app.log).catch((err) =>
          app.log.error(err, "[Omnichannel] Ingestion error")
        );
      }
      return;
    }

    // Process asynchronously
    try {
      const { messages, statuses, phoneNumberId } = parseWebhookPayload(body);

      if (!phoneNumberId) return;

      // Find the WhatsApp number in our system
      const waNumber = await prisma.whatsAppNumber.findFirst({
        where: { wabaId: phoneNumberId },
        include: { workspace: true },
      });

      if (!waNumber) {
        app.log.warn(`[Webhook] Unknown phone number ID: ${phoneNumberId}`);
        return;
      }

      // ── Process inbound messages ──────────────────────────────────
      for (const msg of messages) {
        app.log.info(`[Webhook] Inbound message from ${msg.from}: ${msg.type}`);

        // Find or create contact
        let contact = await prisma.contact.findUnique({
          where: {
            phoneNumber_workspaceId: {
              phoneNumber: msg.from,
              workspaceId: waNumber.workspaceId,
            },
          },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              workspaceId: waNumber.workspaceId,
              phoneNumber: msg.from,
              leadStage: "NEW",
            },
          });
        }

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: {
            contactId: contact.id,
            whatsappNumberId: waNumber.id,
            status: { not: "CLOSED" },
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              whatsappNumberId: waNumber.id,
              contactId: contact.id,
              workspaceId: waNumber.workspaceId,
              status: "OPEN",
              lastMessageAt: new Date(),
              adId: msg.context?.ad_id || null,
              adTitle: msg.context?.ad_title || null,
            },
          });

          // Broadcast new conversation event
          broadcastToWorkspace(waNumber.workspaceId, {
            type: "conversation:new",
            payload: { conversation, contact },
            timestamp: new Date().toISOString(),
          });

          // Handle auto-assignment
          if (waNumber.workspace.autoAssign) {
            const assignedAgentId = await autoAssignConversation(waNumber.workspaceId, conversation.id);
            if (assignedAgentId) {
              conversation.assignedAgentId = assignedAgentId;
              broadcastToWorkspace(waNumber.workspaceId, {
                type: "conversation:assigned",
                payload: { conversationId: conversation.id, assignedAgentId },
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        // Extract message body
        let messageBody: string | null = null;
        let mediaUrl: string | null = null;

        switch (msg.type) {
          case "text":
            messageBody = msg.text?.body || null;
            break;
          case "image":
          case "video":
          case "document":
          case "audio":
            // Media messages — store media ID, download later
            mediaUrl = (msg as any)[msg.type]?.id || null;
            messageBody = (msg as any)[msg.type]?.caption || null;
            break;
          case "interactive": {
            const listReplyId = msg.interactive?.list_reply?.id;
            if (listReplyId && listReplyId.startsWith("csat_")) {
              // csat_conversationId_score
              const parts = listReplyId.split("_");
              if (parts.length >= 3) {
                const targetConversationId = parts.slice(1, -1).join("_");
                const score = parseInt(parts[parts.length - 1], 10);
                
                // Save CSAT Response
                await prisma.cSATResponse.upsert({
                  where: { conversationId: targetConversationId },
                  create: {
                    conversationId: targetConversationId,
                    workspaceId: waNumber.workspaceId,
                    contactId: contact.id,
                    score,
                  },
                  update: { score },
                });

                messageBody = `Rated CSAT: ${score}/5`;
              }
            } else {
              messageBody = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null;
            }
            break;
          }
          case "order": {
            const orderDetails = (msg as any).order;
            if (orderDetails) {
              const items = orderDetails.product_items || [];
              let totalAmount = 0;
              let currency = "USD";
              
              for (const item of items) {
                totalAmount += (parseFloat(item.item_price || "0") * parseInt(item.quantity || "1", 10));
                if (item.currency) currency = item.currency;
              }

              await prisma.ecomOrder.create({
                data: {
                  externalOrderId: `wa-${msg.id}`,
                  totalAmount,
                  currency,
                  status: "PENDING_PAYMENT",
                  items: items,
                  workspaceId: waNumber.workspaceId,
                  contactId: contact.id,
                }
              });
              
              messageBody = `🛍️ New WhatsApp Catalog Order! Total: ${totalAmount} ${currency}`;
            }
            break;
          }
        }

        // Create message record
        const newMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "INBOUND",
            type: msg.type.toUpperCase() as any,
            content: { text: messageBody, mediaUrl: null },
            status: "DELIVERED",
            waMessageId: msg.id,
          },
        });

        // Update conversation
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(Number(msg.timestamp) * 1000),
            ...(msg.context?.ad_id ? { adId: msg.context.ad_id } : {}),
            ...(msg.context?.ad_title ? { adTitle: msg.context.ad_title } : {}),
          },
        });

        // Broadcast to WebSocket clients
        broadcastToWorkspace(waNumber.workspaceId, {
          type: "message:new",
          payload: {
            message: newMessage,
            conversationId: conversation.id,
            contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
          },
          timestamp: new Date().toISOString(),
        });

        // Auto mark as read (send read receipts)
        const accessToken = process.env.META_ACCESS_TOKEN;
        if (accessToken && msg.id) {
          markAsRead(
            { accessToken, phoneNumberId, wabaId: waNumber.wabaId, webhookVerifyToken: "" },
            msg.id
          ).catch(() => {});
        }

        // Check business hours and send away message if needed
        let handledByAwayMessage = false;
        if (accessToken && !isWithinBusinessHours(waNumber.workspace)) {
          const awayMsg = waNumber.workspace.awayMessage;
          if (awayMsg) {
            // Check if we already sent an away message recently (e.g. in last 12 hours)
            const lastOutbound = await prisma.message.findFirst({
              where: { conversationId: conversation.id, direction: "OUTBOUND", type: "TEXT" },
              orderBy: { createdAt: 'desc' }
            });
            
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            
            if (!lastOutbound || lastOutbound.createdAt < twelveHoursAgo || (lastOutbound.content as any)?.text !== awayMsg) {
              const waRes = await sendMessage(
                { accessToken, phoneNumberId, wabaId: waNumber.wabaId, webhookVerifyToken: "" },
                contact.phoneNumber,
                { type: "text", text: { body: awayMsg } }
              );
              
              const awayMessageRecord = await prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  direction: "OUTBOUND",
                  type: "TEXT",
                  content: { text: awayMsg },
                  status: "SENT",
                  waMessageId: waRes.messages?.[0]?.id,
                },
              });

              broadcastToWorkspace(waNumber.workspaceId, {
                type: "message:new",
                payload: {
                  message: awayMessageRecord,
                  conversationId: conversation.id,
                  contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
                },
                timestamp: new Date().toISOString(),
              });
              
              handledByAwayMessage = true;
            }
          }
        }

        // Evaluate chatbot flows (skip if away message was sent to avoid double response, unless desired. We'll skip for now)
        if (accessToken && messageBody && !handledByAwayMessage) {
          await evaluateFlow(
            messageBody,
            contact.id,
            waNumber.workspaceId,
            waNumber.wabaId,
            phoneNumberId,
            accessToken
          );
        }

        // Product image recognition: if the customer sent a photo, try to match
        // it to the catalog and reply with the product (+ add it to their cart).
        // Non-blocking so a slow vision call never delays webhook processing.
        if (accessToken && msg.type === "image" && mediaUrl) {
          void handleProductImage(
            waNumber.workspaceId,
            contact.id,
            contact.phoneNumber,
            conversation.id,
            mediaUrl,
            { accessToken, phoneNumberId, wabaId: waNumber.wabaId, webhookVerifyToken: "" },
            app.log
          ).catch((err) => app.log.error(err, "[Webhook] product image match failed"));
        }
      }

      // ── Process status updates ────────────────────────────────────
      for (const status of statuses) {
        const message = await prisma.message.findFirst({
          where: { waMessageId: status.id },
        });

        if (message) {
          const statusMap: Record<string, string> = {
            sent: "SENT",
            delivered: "DELIVERED",
            read: "READ",
            failed: "FAILED",
          };

          await prisma.message.update({
            where: { id: message.id },
            data: { status: statusMap[status.status] as any },
          });

          // Broadcast status update
          broadcastToWorkspace(waNumber.workspaceId, {
            type: "message:status",
            payload: {
              messageId: message.id,
              conversationId: message.conversationId,
              status: statusMap[status.status],
              waMessageId: status.id,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      app.log.error(err, "[Webhook] Processing error:");
    }
  });

  // ─── Shopify Webhooks ───────────────────────────────────────────────────────
  app.post("/shopify", async (request: FastifyRequest<{ Querystring: { workspaceId: string } }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send("workspaceId is required");

    // Shopify sends the topic in the headers
    const topic = request.headers["x-shopify-topic"] as string;
    const hmac = request.headers["x-shopify-hmac-sha256"] as string | undefined;

    const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
    const sig = verifyShopifySignature(rawBody, hmac);
    if (!sig.valid) {
      app.log.warn(`[Shopify Webhook] Rejected: ${sig.reason ?? "invalid HMAC"}`);
      return reply.status(401).send("Invalid signature");
    }
    
    // Process async so we return 200 immediately to Shopify
    handleShopifyWebhook(workspaceId, topic, request.body).catch(err => {
      app.log.error("[Shopify Webhook] Error:", err);
    });

    return reply.status(200).send("OK");
  });

  // ─── WooCommerce Webhooks ───────────────────────────────────────────────────
  app.post("/woocommerce", async (request: FastifyRequest<{ Querystring: { workspaceId: string } }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send("workspaceId is required");

    // WooCommerce sends the event name and HMAC in headers.
    const topic = request.headers["x-wc-webhook-topic"] as string;
    const signature = request.headers["x-wc-webhook-signature"] as string | undefined;

    const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
    const sig = verifyWooCommerceSignature(rawBody, signature);
    if (!sig.valid) {
      app.log.warn(`[WooCommerce Webhook] Rejected: ${sig.reason ?? "invalid signature"}`);
      return reply.status(401).send("Invalid signature");
    }

    // Process async so we return 200 immediately to WooCommerce.
    handleWooCommerceWebhook(workspaceId, topic, request.body).catch(err => {
      app.log.error(err, "[WooCommerce Webhook] Error");
    });

    return reply.status(200).send("OK");
  });
}
