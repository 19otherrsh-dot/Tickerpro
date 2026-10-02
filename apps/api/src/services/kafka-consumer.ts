import { Kafka } from "kafkajs";
import { prisma } from "@tickerpro/database/client";
import Redis from "ioredis";
import { initClickHouse, trackMessageAnalytics } from "./clickhouse.js";
import { triggerOutboundWebhook } from "../lib/webhooks.js";
import { analyzeSentiment, generateAIResponse } from "./ai.js";
import { isAIConfigured } from "./ai-gateway.js";

const kafka = new Kafka({
  clientId: "api-worker",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9094").split(","),
});

const consumer = kafka.consumer({ groupId: "api-messages-group" });
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export interface WhatsAppWebhookEntry {
  changes?: {
    value?: {
      messages?: Array<{
        id: string;
        from: string;
        type: "text" | "image" | "video" | "audio" | "document" | "interactive" | "order";
        text?: { body: string };
        interactive?: {
          list_reply?: { id: string; title: string };
          button_reply?: { id: string; title: string };
        };
        order?: {
          product_items?: Array<{ item_price?: string; quantity?: string; currency?: string }>;
        };
        [key: string]: any;
      }>;
      metadata?: { phone_number_id: string };
      contacts?: Array<{ profile?: { name?: string } }>;
    };
  }[];
}

async function processMessage(payload: { entry?: WhatsAppWebhookEntry[] }) {
  try {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const metadata = value?.metadata;
    
    if (!messages || messages.length === 0) return;

    const phoneNumberId = metadata?.phone_number_id;
    const msg = messages[0];
    // Both are required to route the message; bail out rather than proceed with
    // an undefined phone number id (which would silently match nothing).
    if (!msg || !phoneNumberId) return;

    const fromPhone = msg.from;
    const waMessageId = msg.id;
  
  console.log(`[Kafka] Processing message from ${fromPhone} on WA ID ${waMessageId}`);

  const waNumber = await prisma.whatsAppNumber.findUnique({
    where: { phoneNumberId },
  });

  if (!waNumber) {
    console.warn(`[Kafka] Unknown WhatsApp Number ID: ${phoneNumberId}`);
    return;
  }

  const workspaceId = waNumber.workspaceId;

  const contact = await prisma.contact.upsert({
    where: {
      phoneNumber_workspaceId: {
        phoneNumber: fromPhone,
        workspaceId,
      },
    },
    update: {},
    create: {
      phoneNumber: fromPhone,
      workspaceId,
      name: value.contacts?.[0]?.profile?.name || "Unknown Contact",
    },
  });

  let conversation = await prisma.conversation.findFirst({
    where: {
      contactId: contact.id,
      whatsappNumberId: waNumber.id,
      status: "OPEN",
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        workspaceId,
        whatsappNumberId: waNumber.id,
      },
    });
  }

  let messageBody: string | null = null;
  let mediaUrl: string | null = null;
  let messageType: any = (msg.type || "TEXT").toUpperCase();

  switch (msg.type) {
    case "text":
      messageBody = msg.text?.body || null;
      break;
    case "image":
    case "video":
    case "document":
    case "audio":
      mediaUrl = (msg as any)[msg.type]?.id || null;
      messageBody = (msg as any)[msg.type]?.caption || null;
      break;
    case "interactive": {
      const listReplyId = msg.interactive?.list_reply?.id;
      if (listReplyId && listReplyId.startsWith("csat_")) {
        const parts = listReplyId.split("_");
        if (parts.length >= 3) {
          const targetConversationId = parts.slice(1, -1).join("_");
          const score = parseInt(parts[parts.length - 1] ?? "", 10);

          await prisma.cSATResponse.upsert({
            where: { conversationId: targetConversationId },
            create: {
              conversationId: targetConversationId,
              workspaceId,
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
            externalOrderId: `wa-${waMessageId}`,
            totalAmount,
            currency,
            status: "PENDING_PAYMENT",
            items: items,
            workspaceId,
            contactId: contact.id,
          }
        });
        
        messageBody = `🛍️ New WhatsApp Catalog Order! Total: ${totalAmount} ${currency}`;
      }
      break;
    }
  }

  const dbMessage = await prisma.message.create({
    data: {
      waMessageId,
      direction: "INBOUND",
      type: messageType,
      content: { text: messageBody, mediaUrl },
      status: "DELIVERED",
      conversationId: conversation.id,
    },
  });

  // Trigger Outbound Webhook
  triggerOutboundWebhook(workspaceId, "message.received", {
    message: dbMessage,
    conversationId: conversation.id,
    contact: { id: contact.id, phone: contact.phoneNumber, name: contact.name }
  }).catch(console.error);

  // Fetch recent messages for sentiment analysis
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  const payloadForAi = {
    messages: recentMessages.map(m => ({
      role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
      content: String((m.content as any)?.text || "")
    })).concat([{ role: "user" as const, content: msg.text?.body || "" }])
  };

  let sentiment = "NEUTRAL";
  let sentimentScore = 0.0;

  try {
    // Sentiment now runs through the Node AI gateway (Ollama/OpenAI) instead of
    // the retired Python ai-service. Degrades to NEUTRAL when no model is set.
    const result = await analyzeSentiment(payloadForAi.messages);
    sentiment = result.sentiment;
    sentimentScore = result.score;
  } catch (err) {
    console.error("[Kafka] Failed to analyze sentiment", err);
  }

  let updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      isUnread: true,
      sentiment: sentiment as any,
      sentimentScore: sentimentScore,
    },
  });

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  // Sentiment-Based Routing
  if (!updatedConversation.assignedAgentId && (sentiment === "NEGATIVE" || sentiment === "CHURN_RISK")) {
    const agent = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        role: "AGENT",
        user: { isActive: true }
      },
      include: { user: true }
    });
    
    if (agent) {
      updatedConversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedAgentId: agent.userId }
      });
      console.log(`[Kafka] Auto-assigned NEGATIVE/CHURN_RISK conversation ${conversation.id} to agent ${agent.userId}`);
    }
  }

  // Auto-Assignment (Capacity-Based)
  if (!updatedConversation.assignedAgentId && workspace?.autoAssign) {
    const agents = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        role: "AGENT",
        user: { isActive: true }
      },
      select: { userId: true }
    });

    if (agents.length > 0) {
      const agentLoads = await Promise.all(agents.map(async (a) => {
        const count = await prisma.conversation.count({
          where: { assignedAgentId: a.userId, status: "OPEN" }
        });
        return { userId: a.userId, count };
      }));
      
      agentLoads.sort((a, b) => a.count - b.count);
      const selectedAgent = agentLoads[0];

      if (selectedAgent) {
        updatedConversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: { assignedAgentId: selectedAgent.userId }
        });
        console.log(`[Kafka] Auto-assigned conversation ${conversation.id} to agent ${selectedAgent.userId} via load-balancing`);
      }
    }
  }

  // AI Auto-Reply Agent (if still unassigned, and only when a model is configured
  // so we never auto-send a fallback/error string to a customer).
  if (!updatedConversation.assignedAgentId && isAIConfigured()) {
    try {
      // RAG answer now comes from the Node AI gateway (knowledge-base grounded),
      // replacing the Python ai-service `/ask` endpoint.
      const answer = await generateAIResponse(workspaceId, msg.text?.body || "");

      // Skip when the model declined or errored — don't auto-reply with a non-answer.
      const declined = /i don't know|don't have that information|couldn't process|technical difficulties/i;
      if (answer && !declined.test(answer)) {
        const askData = { answer };
        if (askData.answer) {
          const replyMessage = await prisma.message.create({
            data: {
              waMessageId: `auto-${Date.now()}`,
              direction: "OUTBOUND",
              type: "TEXT",
              content: { text: askData.answer },
              status: "QUEUED",
              conversationId: conversation.id,
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });

          const replyWsPayload = {
            type: "message:new",
            workspaceId,
            payload: {
              message: replyMessage,
              conversationId: conversation.id,
              contact: contact,
            },
            timestamp: new Date().toISOString(),
          };
          await redis.publish("ws:broadcast", JSON.stringify(replyWsPayload));
          console.log(`[Kafka] Auto-replied to conversation ${conversation.id}`);
        }
      }
    } catch (err) {
      console.error("[Kafka] Failed to auto-reply", err);
    }
  }

  // Track analytics
  await trackMessageAnalytics(
    { ...dbMessage, workspaceId },
    sentiment,
    sentimentScore
  );

  // Broadcast to API WebSockets via Redis Pub/Sub
  const wsPayload = {
    type: "message:new",
    workspaceId,
    payload: {
      message: dbMessage,
      conversationId: conversation.id,
      contact: contact,
    },
    timestamp: new Date().toISOString(),
  };

  await redis.publish("ws:broadcast", JSON.stringify(wsPayload));
  console.log(`[Kafka] Message broadcasted to workspace ${workspaceId}`);
  } catch (globalErr) {
    console.error("[Kafka] Critical error processing message, safely aborted:", globalErr);
  }
}

export async function startKafkaConsumer() {
  try {
    await initClickHouse();
    
    await consumer.connect();
    console.log("[Kafka] 🚀 Consumer connected");

    await consumer.subscribe({ topic: "inbound-messages", fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payloadStr = message.value?.toString();
          if (payloadStr) {
            const payload = JSON.parse(payloadStr);
            await processMessage(payload);
          }
        } catch (err) {
          console.error("[Kafka] ❌ Error processing message", err);
        }
      },
    });
  } catch (err) {
    console.error("[Kafka] ❌ Failed to start consumer:", err);
  }
}

/** Disconnect the Kafka consumer and its Redis client for graceful shutdown. */
export async function stopKafkaConsumer(): Promise<void> {
  await consumer.disconnect().catch(() => {});
  await redis.quit().catch(() => {});
}
