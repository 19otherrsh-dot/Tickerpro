/**
 * Broadcast execution engine.
 *
 * Fans a broadcast out to every recipient in the workspace, sends the template
 * via the Meta WhatsApp Cloud API, tracks counters, and emits live progress
 * over WebSocket. Invoked by the worker (durable) or inline (dev fallback).
 */

import { prisma } from "@tickerpro/database/client";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { broadcastToWorkspace } from "../routes/ws.js";

const PROGRESS_EVERY = 25;

export async function executeBroadcast(broadcastId: string): Promise<void> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { whatsappNumber: true },
  });

  if (!broadcast) {
    console.warn(`[broadcast] ${broadcastId} not found`);
    return;
  }
  // Don't re-send terminal broadcasts (e.g. cancelled before the job ran).
  if (broadcast.status === "COMPLETED" || broadcast.status === "CANCELLED") {
    return;
  }

  const waNumber =
    broadcast.whatsappNumber ??
    (await prisma.whatsAppNumber.findFirst({
      where: { workspaceId: broadcast.workspaceId, isActive: true },
    }));

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", sentAt: new Date() },
  });

  let whereClause: any = { workspaceId: broadcast.workspaceId };

  if (broadcast.audienceFilter && (broadcast.audienceFilter as any).segmentId) {
    const segment = await prisma.segment.findUnique({
      where: { id: (broadcast.audienceFilter as any).segmentId }
    });
    
    if (segment && Array.isArray(segment.rules)) {
      const conditions = segment.rules.map((rule: any) => {
        let condition: any = {};
        if (rule.field === "tag") {
          // ContactTag relation filter
          condition = { contactTags: { some: { tag: { name: { equals: rule.value, mode: "insensitive" } } } } };
          if (rule.operator === "NOT_EQUALS") condition = { NOT: condition };
        } else {
          // Direct field filter
          let operatorMap: any = { "EQUALS": "equals", "NOT_EQUALS": "not", "CONTAINS": "contains" };
          let prismaOp = operatorMap[rule.operator] || "equals";
          // If checking an enum like LeadStage, casing matters. For others, maybe insensitive
          if (rule.field === "leadStage") {
            condition = { [rule.field]: rule.value.toUpperCase() };
            if (rule.operator === "NOT_EQUALS") condition = { [rule.field]: { not: rule.value.toUpperCase() } };
          } else {
            condition = { [rule.field]: { [prismaOp]: rule.value, mode: "insensitive" } };
          }
        }
        return condition;
      });

      if (conditions.length > 0) {
        if (segment.matchType === "ANY") {
          whereClause.OR = conditions;
        } else {
          whereClause.AND = conditions;
        }
      }
    }
  }

  const recipients = await prisma.contact.findMany({
    where: whereClause,
    select: { phoneNumber: true },
  });

  const accessToken = process.env.META_ACCESS_TOKEN;
  const canSend = Boolean(waNumber && accessToken && broadcast.templateName);
  if (!canSend) {
    console.warn(
      `[broadcast] ${broadcastId} missing send prerequisites (number/token/template) — recording as failed`
    );
  }

  let sent = broadcast.sent || 0;
  let delivered = broadcast.delivered || 0;
  let failed = broadcast.failed || 0;

  // A/B Testing Batching
  let targetRecipients = recipients;
  if (broadcast.isABTest && !broadcast.winnerSelected) {
    // Send to 20% for the test batch
    const testSize = Math.max(2, Math.floor(recipients.length * 0.2));
    if (sent < testSize) {
      targetRecipients = recipients.slice(sent, testSize);
    } else {
      // Test batch already sent, waiting for evaluation
      return;
    }
  } else if (broadcast.isABTest && broadcast.winnerSelected) {
    // Send to the remaining 80% using the winner
    targetRecipients = recipients.slice(sent);
  }

  for (let i = 0; i < targetRecipients.length; i++) {
    const contact = targetRecipients[i];
    if (!contact) continue;
    try {
      if (!canSend || !waNumber) {
        failed++;
      } else {
        // Alternate between A and B if winner not selected
        let selectedTemplate = broadcast.templateName as string;
        if (broadcast.isABTest) {
          if (broadcast.winnerSelected) {
            selectedTemplate = broadcast.winnerSelected;
          } else if (broadcast.templateA && broadcast.templateB) {
            selectedTemplate = i % 2 === 0 ? broadcast.templateA : broadcast.templateB;
          }
        }

        const result = await sendWhatsAppMessage(
          {
            accessToken: accessToken as string,
            phoneNumberId: waNumber.phoneNumberId,
            wabaId: waNumber.wabaId,
            webhookVerifyToken: "",
          },
          {
            phoneNumberId: waNumber.phoneNumberId,
            to: contact.phoneNumber,
            type: "template",
            template: {
              name: selectedTemplate,
              language: { code: "en_US" },
            },
          }
        );
        if (result.success) {
          sent++;
          delivered++; // optimistic; real delivered/read arrive via status webhooks
        } else {
          failed++;
        }
      }
    } catch (err) {
      failed++;
      console.error(`[broadcast] send to ${contact.phoneNumber} failed:`, err);
    }

    if ((sent + failed) % PROGRESS_EVERY === 0) {
      broadcastToWorkspace(broadcast.workspaceId, {
        type: "broadcast:progress",
        payload: { broadcastId, sent, delivered, failed, total: recipients.length },
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (broadcast.isABTest && !broadcast.winnerSelected) {
    // Test batch complete, pause and schedule evaluation
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 60 * 60 * 1000), sent, delivered, failed }, // Eval in 1 hr
    });
    console.log(`[broadcast] A/B test batch sent. Waiting 1 hr to resolve.`);
  } else {
    // Full broadcast complete
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "COMPLETED", completedAt: new Date(), sent, delivered, failed },
    });

    broadcastToWorkspace(broadcast.workspaceId, {
      type: "broadcast:progress",
      payload: {
        broadcastId,
        sent,
        delivered,
        failed,
        total: recipients.length,
        status: "COMPLETED",
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function resolveABTests(): Promise<void> {
  const evaluatingBroadcasts = await prisma.broadcast.findMany({
    where: {
      isABTest: true,
      winnerSelected: null,
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
      sent: { gt: 0 }
    }
  });

  for (const b of evaluatingBroadcasts) {
    // In a real scenario, we'd query ClickHouse or Prisma message stats to see
    // which template drove higher 'READ' or 'REPLIED' rates.
    // For this implementation, we will simulate the evaluation.
    const winner = Math.random() > 0.5 ? b.templateA : b.templateB;
    
    if (winner) {
      await prisma.broadcast.update({
        where: { id: b.id },
        data: { winnerSelected: winner, scheduledAt: new Date(), status: "SCHEDULED" }
      });
      console.log(`[broadcast] A/B test ${b.id} resolved. Winner: ${winner}. Resuming broadcast.`);
    }
  }
}

