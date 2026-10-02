import { prisma } from "@tickerpro/database/client";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

/**
 * Process SLA breaches across all workspaces.
 *
 * Each workspace can configure its own `slaResponseMinutes` threshold (Feature 1:
 * Wati/DoubleTick parity). When `slaResponseMinutes` is null the workspace has SLA
 * checking disabled — those conversations are skipped.
 *
 * The cron runs every minute (see worker.ts). Breached conversations receive:
 *   1. A `slaBreach = true` flag.
 *   2. An auto-generated internal note visible to agents/managers.
 *   3. Auto-reassignment to the first available MANAGER in the workspace.
 *   4. A real-time WebSocket event so the dashboard highlights the conversation.
 */
export async function processSLABreaches() {
  console.log(`[SLA Engine] Scanning for SLA breaches...`);

  // Pull all workspaces that have SLA enabled (slaResponseMinutes is not null)
  const workspaces = await prisma.workspace.findMany({
    where: {
      isActive: true,
      slaResponseMinutes: { not: null },
    },
    select: {
      id: true,
      slaResponseMinutes: true,
      members: {
        where: { role: "MANAGER" },
        select: { userId: true },
      },
    },
  });

  let totalBreached = 0;

  for (const workspace of workspaces) {
    const thresholdMs = (workspace.slaResponseMinutes ?? 15) * 60 * 1000;
    const cutoff = new Date(Date.now() - thresholdMs);

    const breachedConversations = await prisma.conversation.findMany({
      where: {
        workspaceId: workspace.id,
        status: "OPEN",
        slaBreach: false,
        lastMessageAt: { lt: cutoff },
        // Only trigger when the last message was inbound (customer hasn't been replied to)
        messages: {
          none: {
            direction: "OUTBOUND",
            createdAt: { gte: cutoff },
          },
        },
      },
      include: { contact: true },
    });

    for (const conv of breachedConversations) {
      // 1. Mark as breached
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { slaBreach: true },
      });

      // 2. Add an internal note
      const thresholdLabel =
        (workspace.slaResponseMinutes ?? 15) >= 60
          ? `${Math.round((workspace.slaResponseMinutes ?? 15) / 60)}h`
          : `${workspace.slaResponseMinutes ?? 15}min`;
      await prisma.internalNote.create({
        data: {
          conversationId: conv.id,
          content: `🚨 SLA Breach: No agent response within ${thresholdLabel}. Auto-escalated to management.`,
        },
      });

      // 3. Reassign to first available Manager
      const manager = workspace.members[0];
      if (manager) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { assignedAgentId: manager.userId },
        });
        console.log(
          `[SLA Engine] Escalated Conversation ${conv.id} to Manager ${manager.userId}`
        );
      }

      // 4. Real-time WebSocket broadcast
      await redis.publish(
        "ws:broadcast",
        JSON.stringify({
          type: "conversation:update",
          workspaceId: conv.workspaceId,
          payload: {
            conversationId: conv.id,
            assignedAgentId: manager?.userId ?? null,
            slaBreach: true,
          },
          timestamp: new Date().toISOString(),
        })
      );

      totalBreached++;
    }
  }

  console.log(`[SLA Engine] Processed ${totalBreached} SLA breaches across ${workspaces.length} workspaces.`);
}
