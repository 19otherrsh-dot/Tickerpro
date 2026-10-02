import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { sendCSATSurvey } from "../services/csat.js";
import { generateAIResponse } from "../services/ai.js";
import { triggerOutboundWebhook } from "../lib/webhooks.js";
import { scoreCxQuality } from "../services/copilot.js";
import { syncContactToCrm } from "../services/integrations/crm.js";
import { applyMaskToContact } from "../lib/mask.js";

export async function conversationRoutes(app: FastifyInstance) {
  // ── List conversations ────────────────────────────────────────────
  app.get(
    "/",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const { status, assignedTo, search } = request.query as Record<string, string>;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: { select: { maskPhoneNumbers: true } } },
      });
      if (!membership) return { conversations: [], total: 0 };

      const where: any = { workspaceId: membership.workspaceId };
      if (status) where.status = status;
      if (assignedTo) where.assignedAgentId = assignedTo;
      if (search) {
        where.contact = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search } },
          ],
        };
      }

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          include: {
            contact: true,
            assignedAgent: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { lastMessageAt: "desc" },
          take: 50,
        }),
        prisma.conversation.count({ where }),
      ]);

      // Apply phone-number masking for AGENT-role members (Feature 3)
      const maskEnabled = (membership as any).workspace?.maskPhoneNumbers ?? false;
      const maskedConversations = conversations.map((c) => ({
        ...c,
        contact: applyMaskToContact(c.contact, membership.role, maskEnabled),
      }));

      return { conversations: maskedConversations, total };
    }
  );

  // ── Get single conversation with messages ─────────────────────────
  app.get(
    "/:id",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user as { userId: string };

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          contact: true,
          assignedAgent: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!conversation) return { error: "Conversation not found" };

      // Apply phone masking for AGENT role (Feature 3)
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId: conversation.workspaceId },
        include: { workspace: { select: { maskPhoneNumbers: true } } },
      });
      const maskEnabled = (membership as any)?.workspace?.maskPhoneNumbers ?? false;
      const maskedConversation = {
        ...conversation,
        contact: applyMaskToContact(conversation.contact, membership?.role ?? "AGENT", maskEnabled),
      };

      return maskedConversation;
    }
  );

  // ── Assign agent ──────────────────────────────────────────────────
  app.post(
    "/:id/assign",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { agentId } = request.body as { agentId: string };

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { assignedAgentId: agentId },
        include: { contact: true },
      });

      return conversation;
    }
  );

  // ── Close conversation ────────────────────────────────────────────
  app.post(
    "/:id/close",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { status: "CLOSED" },
        include: { whatsappNumber: true, contact: true, messages: true }
      });

      // ── Fire all post-close side-effects asynchronously ─────────────
      if (conversation.whatsappNumber) {
        // CSAT survey
        sendCSATSurvey(conversation.whatsappNumber.workspaceId, conversation.id).catch(console.error);

        // Outbound webhook
        triggerOutboundWebhook(conversation.workspaceId, "conversation.closed", conversation).catch(console.error);

        // ── AI CX Quality Score (Feature 4) ──────────────────────────
        scoreCxQuality(conversation.id).catch((err) =>
          console.error("[CX Score] Failed background scoring", err)
        );

        // ── HubSpot CRM sync ─────────────────────────────────────────
        (async () => {
          try {
            const { HubSpotService } = await import("../services/hubspot.js");
            const hubspot = new HubSpotService(conversation.workspaceId);
            const isConnected = await hubspot.init();

            if (isConnected) {
              const contactId = await hubspot.syncContact(
                conversation.contact.phoneNumber,
                conversation.contact.name || undefined,
                conversation.contact.email || undefined
              );

              if (contactId) {
                const summary = `Conversation with ${conversation.contact.phoneNumber} closed. Agent: ${conversation.assignedAgentId || 'Unassigned'}. Messages: ${conversation.messages?.length || 0}`;
                await hubspot.addConversationNote(contactId, summary, conversation.sentiment || undefined);
                console.log("[HubSpot] Successfully synced conversation", conversation.id);
              }
            }
          } catch (err) {
            console.error("[HubSpot] Failed background CRM sync", err);
          }
        })();

        // ── Salesforce CRM sync (Feature 5) ──────────────────────────
        syncContactToCrm("salesforce", conversation.workspaceId, {
          phoneNumber: conversation.contact.phoneNumber,
          name: conversation.contact.name,
          email: conversation.contact.email,
        }).then((result) => {
          if (result.success) {
            console.log("[Salesforce] Synced contact", result.externalId);
          } else if (!result.skipped) {
            console.warn("[Salesforce] Sync failed:", result.error);
          }
        }).catch((err) => console.error("[Salesforce] Background sync error", err));

        // ── Zoho CRM sync (Feature 5) ─────────────────────────────────
        syncContactToCrm("zoho", conversation.workspaceId, {
          phoneNumber: conversation.contact.phoneNumber,
          name: conversation.contact.name,
          email: conversation.contact.email,
        }).then((result) => {
          if (result.success) {
            console.log("[Zoho] Synced contact", result.externalId);
          } else if (!result.skipped) {
            console.warn("[Zoho] Sync failed:", result.error);
          }
        }).catch((err) => console.error("[Zoho] Background sync error", err));
      }

      return conversation;
    }
  );

  // ── Reopen conversation ───────────────────────────────────────────
  app.post(
    "/:id/reopen",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { status: "OPEN" },
      });

      return conversation;
    }
  );

  // ── Internal notes ────────────────────────────────────────────────
  app.get(
    "/:id/notes",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const notes = await prisma.internalNote.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "asc" },
      });
      return { notes };
    }
  );

  app.post(
    "/:id/notes",
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { content } = request.body as { content?: string };
      if (!content?.trim()) {
        return reply.status(400).send({ error: "content is required" });
      }
      const note = await prisma.internalNote.create({
        data: { conversationId: id, content: content.trim() },
      });
      return reply.status(201).send(note);
    }
  );

  // ── Conversation tags ─────────────────────────────────────────────
  app.get(
    "/:id/tags",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const links = await prisma.conversationTag.findMany({
        where: { conversationId: id },
        include: { tag: true },
      });
      return { tags: links.map((l) => l.tag) };
    }
  );

  app.post(
    "/:id/tags",
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, color } = request.body as { name?: string; color?: string };
      if (!name?.trim()) {
        return reply.status(400).send({ error: "name is required" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { workspaceId: true, contactId: true },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // Reuse an existing workspace tag by name, or create it on the fly.
      const tag = await prisma.tag.upsert({
        where: { name_workspaceId: { name: name.trim(), workspaceId: conversation.workspaceId } },
        create: { name: name.trim(), color: color || "#6366F1", workspaceId: conversation.workspaceId },
        update: {},
      });

      await prisma.conversationTag.upsert({
        where: { conversationId_tagId: { conversationId: id, tagId: tag.id } },
        create: { conversationId: id, tagId: tag.id },
        update: {},
      });

      // Check for Drip Campaign Auto-Enrollment
      try {
        const campaigns = await prisma.dripCampaign.findMany({
          where: {
            workspaceId: conversation.workspaceId,
            status: "ACTIVE",
            triggerType: "TAG_ADDED"
          }
        });

        for (const campaign of campaigns) {
          const triggerData = campaign.triggerData as any;
          if (triggerData && triggerData.tag && triggerData.tag.toLowerCase() === tag.name.toLowerCase()) {
            // Enroll the contact
            await prisma.dripEnrollment.upsert({
              where: {
                campaignId_contactId: {
                  campaignId: campaign.id,
                  contactId: conversation.contactId
                }
              },
              create: {
                campaignId: campaign.id,
                contactId: conversation.contactId,
                currentStep: 0,
                nextRunAt: new Date(), // run immediately
                status: "ACTIVE"
              },
              update: {} // do not restart if already enrolled
            });
            console.log(`[Drip] Auto-enrolled contact ${conversation.contactId} into campaign ${campaign.id}`);
          }
        }
      } catch (err) {
        console.error("Failed to process auto-enrollment for drip campaign", err);
      }

      return reply.status(201).send(tag);
    }
  );

  app.delete(
    "/:id/tags/:tagId",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id, tagId } = request.params as { id: string; tagId: string };
      await prisma.conversationTag.deleteMany({ where: { conversationId: id, tagId } });
      return { success: true };
    }
  );

  // ── AI reply suggestions ──────────────────────────────────────────
  app.get(
    "/:id/ai-suggestions",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };

      // No model configured → return nothing so the UI hides the panel
      // rather than surfacing an error string as a "suggestion".
      if (!process.env.OPENAI_API_KEY) return { suggestions: [] };

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!conversation) return { suggestions: [] };

      const recent = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const ordered = recent.reverse();

      const lastInbound = [...ordered].reverse().find((m) => m.direction === "INBOUND");
      if (!lastInbound) return { suggestions: [] };

      const history = ordered
        .map((m) => ({
          role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
          content: ((m.content as any)?.text as string) || "",
        }))
        .filter((m) => m.content);

      const payloadForAi = {
        messages: history,
        agent_context: "You are a customer support representative. Be concise and helpful."
      };

      try {
        let kbSuggestion: string | null = null;
        
        // 1. Try to query the Knowledge Base first
        try {
          const askRes = await fetch("http://localhost:8000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: conversation.workspaceId,
              question: (lastInbound.content as any)?.text
            })
          }).catch(() => fetch("http://ai-service:8000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: conversation.workspaceId,
              question: (lastInbound.content as any)?.text
            })
          }));

          if (askRes && askRes.ok) {
            const askData = await askRes.json();
            if (askData.answer && !askData.answer.includes("I don't know")) {
              kbSuggestion = "ðŸ“š Knowledge Base: " + askData.answer;
            }
          }
        } catch (err) {
          console.error("Failed to query Knowledge Base", err);
        }

        // 2. Fallback to general AI suggestions
        const aiRes = await fetch("http://localhost:8000/suggest-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadForAi)
        }).catch(() => fetch("http://ai-service:8000/suggest-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadForAi)
        }));

        if (aiRes && aiRes.ok) {
          const aiData = await aiRes.json();
          const suggestions = aiData.suggestions || [];
          if (kbSuggestion) {
            suggestions.unshift(kbSuggestion);
          }
          return { suggestions };
        } else if (kbSuggestion) {
          return { suggestions: [kbSuggestion] };
        }
      } catch (err) {
        console.error("Failed to fetch AI suggestions", err);
      }

      return { suggestions: [] };
    }
  );
}
