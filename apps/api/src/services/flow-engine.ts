import { prisma } from "@tickerpro/database/client";
import { sendMessage, sendCatalogMessage } from "./whatsapp.js";
import { broadcastToWorkspace } from "../routes/ws.js";
import { generateAIResponse } from "./ai.js";

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export async function evaluateFlow(
  inboundMessageText: string | null,
  contactId: string,
  workspaceId: string,
  wabaId: string,
  phoneNumberId: string,
  accessToken: string
): Promise<boolean> {
  if (!inboundMessageText) return false;

  const text = inboundMessageText.toLowerCase().trim();

  // Find an active flow with a matching trigger keyword
  const flows = await prisma.chatbotFlow.findMany({
    where: {
      workspaceId,
      isActive: true,
      triggerType: "KEYWORD",
    },
  });

  let matchedFlow = null;
  for (const flow of flows) {
    if (!flow.triggerValue) continue;
    const keywords = flow.triggerValue.split(",").map((k) => k.trim().toLowerCase());
    if (keywords.includes(text)) {
      matchedFlow = flow;
      break;
    }
  }

  if (!matchedFlow) return false; // No flow matched

  // Execute the matched flow
  try {
    const flowData = matchedFlow.flowData as any;
    if (!flowData || !flowData.nodes) return false;

    const nodes: FlowNode[] = flowData.nodes;
    const edges: FlowEdge[] = flowData.edges || [];

    // Find the trigger node
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) return false;

    // Traverse the graph
    let currentNode: FlowNode | undefined = triggerNode;

    // Simple synchronous execution (MVP only processes immediate action nodes like 'message')
    let safetyCounter = 0;
    while (currentNode && safetyCounter < 10) {
      safetyCounter++;

      let nextSourceHandle: string | undefined;

      // Process current node
      if (currentNode.type === "message") {
        const textContent = currentNode.data.config?.text;
        if (textContent) {
          // Find the contact's phone number
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
          });

          if (contact) {
             // We need conversation to store the message
             let conversation = await prisma.conversation.findFirst({
               where: { contactId: contact.id, status: { not: "CLOSED" } }
             });

             if (conversation) {
               // Send WhatsApp Message via API
               const waRes = await sendMessage(
                 { accessToken, phoneNumberId, wabaId, webhookVerifyToken: "" },
                 contact.phoneNumber,
                 {
                   type: "text",
                   text: { body: textContent },
                 }
               );

               // Store outbound message in DB
               const newMessage = await prisma.message.create({
                 data: {
                   conversationId: conversation.id,
                   direction: "OUTBOUND",
                   type: "TEXT",
                   content: { text: textContent },
                   status: "SENT",
                   waMessageId: waRes.messages?.[0]?.id,
                 },
               });

               // Broadcast to WebSocket clients
               broadcastToWorkspace(workspaceId, {
                 type: "message:new",
                 payload: {
                   message: newMessage,
                   conversationId: conversation.id,
                   contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
                 },
                 timestamp: new Date().toISOString(),
               });
             }
          }
        }
      } else if (currentNode.type === "condition") {
        const conditionText = currentNode.data.config?.condition?.toLowerCase();
        if (conditionText && text.includes(conditionText)) {
           nextSourceHandle = "true";
        } else {
           nextSourceHandle = "false";
        }
      } else if (currentNode.type === "humanHandoff") {
        // Find conversation and mark it OPEN (if it was somehow snoozed/resolved)
        const conversation = await prisma.conversation.findFirst({
           where: { contactId, status: { not: "CLOSED" } }
        });
        if (conversation && conversation.status !== "OPEN") {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: "OPEN" }
          });
        }
        broadcastToWorkspace(workspaceId, {
          type: "conversation:updated",
          payload: { conversationId: conversation?.id, status: "OPEN", note: "Bot handed off to human" },
          timestamp: new Date().toISOString()
        });
      } else if (currentNode.type === "apiRequest") {
        const url = currentNode.data.config?.url;
        if (url) {
          try {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contactId, text, workspaceId })
            });
            console.log(`[FlowEngine] API Request node executed to ${url}`);
          } catch (e) {
            console.error(`[FlowEngine] API Request failed:`, e);
          }
        }
      } else if (currentNode.type === "ai_agent") {
        // AI Agent Node
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
        });

        if (contact) {
          let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, status: { not: "CLOSED" } }
          });

          if (conversation) {
            // Fetch recent history
            const history = await prisma.message.findMany({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: 'desc' },
              take: 5,
            });
            
            const formattedHistory = history.reverse().map(m => ({
              role: m.direction === "INBOUND" ? "user" : "assistant",
              content: (m.content as any)?.text || ""
            })) as { role: "user" | "assistant" | "system", content: string }[];

            const aiResponseText = await generateAIResponse(workspaceId, text, formattedHistory);

            const waRes = await sendMessage(
              { accessToken, phoneNumberId, wabaId, webhookVerifyToken: "" },
              contact.phoneNumber,
              {
                type: "text",
                text: { body: aiResponseText },
              }
            );

            const newMessage = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                type: "TEXT",
                content: { text: aiResponseText },
                status: "SENT",
                waMessageId: waRes.messages?.[0]?.id,
              },
            });

            broadcastToWorkspace(workspaceId, {
              type: "message:new",
              payload: {
                message: newMessage,
                conversationId: conversation.id,
                contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else if (currentNode.type === "catalog") {
        // Send WhatsApp Catalog
        const textContent = currentNode.data.config?.text || "Here is our product catalog.";
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
        });

        if (contact) {
          let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, status: { not: "CLOSED" } }
          });

          if (conversation) {
            const waRes = await sendCatalogMessage(
              { accessToken, phoneNumberId, wabaId, webhookVerifyToken: "" },
              contact.phoneNumber,
              textContent
            );

            const newMessage = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                type: "INTERACTIVE",
                content: { text: textContent, type: "catalog_message" },
                status: "SENT",
                waMessageId: waRes.waMessageId,
              },
            });

            broadcastToWorkspace(workspaceId, {
              type: "message:new",
              payload: {
                message: newMessage,
                conversationId: conversation.id,
                contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Find next node
      let outgoingEdges = edges.filter((e) => e.source === currentNode?.id);
      
      if (nextSourceHandle) {
         outgoingEdges = outgoingEdges.filter(e => e.sourceHandle === nextSourceHandle);
      }

      const nextEdge = outgoingEdges[0];
      if (nextEdge) {
        currentNode = nodes.find((n) => n.id === nextEdge.target);
      } else {
        currentNode = undefined; // End of flow
      }
    }

    return true; // Flow executed successfully
  } catch (error) {
    console.error("[FlowEngine] Execution error:", error);
    return false;
  }
}
