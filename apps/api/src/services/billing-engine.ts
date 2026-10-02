/**
 * Conversation-Based Billing Engine
 *
 * Meta charges per 24-hour conversation window:
 *   - User-Initiated (UIC): customer opens the conversation
 *   - Business-Initiated (BIC): business sends a template first
 *
 * Each workspace has a `walletBalance` credit pool. This service
 * deducts credits when a new conversation window opens and
 * blocks outbound messages when the wallet is depleted.
 */

import { prisma } from "@tickerpro/database/client";
import { logAuditEvent } from "../routes/audit.js";

// Meta pricing (USD) — simplified, region-dependent in reality
const PRICING = {
  USER_INITIATED: 0.005,      // ~$0.005 per user-initiated conversation
  BUSINESS_INITIATED: 0.03,   // ~$0.03 per business-initiated conversation
  SERVICE: 0.0,               // Service conversations (free tier)
};

interface ConversationWindow {
  conversationId: string;
  workspaceId: string;
  type: "USER_INITIATED" | "BUSINESS_INITIATED" | "SERVICE";
  openedAt: Date;
  expiresAt: Date;
}

// In-memory cache of open conversation windows (in production, use Redis)
const activeWindows = new Map<string, ConversationWindow>();

export async function openConversationWindow(
  conversationId: string,
  workspaceId: string,
  type: "USER_INITIATED" | "BUSINESS_INITIATED" | "SERVICE"
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if a window is already open for this conversation
  const existing = activeWindows.get(conversationId);
  if (existing && existing.expiresAt > new Date()) {
    // Window still open — no charge
    return { allowed: true };
  }

  // Calculate cost
  const cost = PRICING[type] || 0;

  // Check wallet balance
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { walletBalance: true },
  });

  if (!workspace) {
    return { allowed: false, reason: "Workspace not found" };
  }

  if (cost > 0 && workspace.walletBalance < cost) {
    return { allowed: false, reason: "Insufficient credits. Please top up your wallet." };
  }

  // Deduct credits
  if (cost > 0) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { walletBalance: { decrement: cost } },
    });

    await logAuditEvent(workspaceId, "BILLING_DEDUCTED", null, {
      conversationId,
      type,
      amount: cost,
      remainingBalance: workspace.walletBalance - cost,
    });
  }

  // Open a new 24-hour window
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  activeWindows.set(conversationId, {
    conversationId,
    workspaceId,
    type,
    openedAt: now,
    expiresAt,
  });

  console.log(
    `[Billing] Opened ${type} window for conversation ${conversationId} — charged $${cost.toFixed(4)}`
  );

  return { allowed: true };
}

export async function addCredits(workspaceId: string, amount: number, userId?: string) {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { walletBalance: { increment: amount } },
  });

  await logAuditEvent(workspaceId, "BILLING_CREDITS_ADDED", userId || null, {
    amount,
    newBalance: workspace.walletBalance,
  });

  return { success: true, newBalance: workspace.walletBalance };
}

export async function getWalletBalance(workspaceId: string): Promise<number> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { walletBalance: true },
  });
  return workspace?.walletBalance ?? 0;
}

// Cleanup expired windows (run periodically)
export function cleanupExpiredWindows() {
  const now = new Date();
  for (const [key, window] of activeWindows.entries()) {
    if (window.expiresAt <= now) {
      activeWindows.delete(key);
    }
  }
}

export async function reconcileBilling(workspaceId: string): Promise<{ success: boolean; adjustments: number; reason?: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { integrations: { where: { type: "META" } } }
  });

  if (!workspace || !workspace.metaBusinessId) {
    return { success: false, adjustments: 0, reason: "Workspace has no connected WABA ID" };
  }

  const metaIntegration = workspace.integrations[0];
  if (!metaIntegration || !metaIntegration.isActive) {
    return { success: false, adjustments: 0, reason: "Meta integration not active" };
  }

  const config = metaIntegration.config as any;
  const token = config.accessToken;

  if (!token) {
    return { success: false, adjustments: 0, reason: "Missing Meta Access Token" };
  }

  try {
    // For scaffolding, we query Meta's conversation analytics for the last 30 days
    // In a production environment, this should be scoped precisely.
    const start = Math.floor(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
    const end = Math.floor(Date.now() / 1000);
    const url = `https://graph.facebook.com/v19.0/${workspace.metaBusinessId}/conversation_analytics?start=${start}&end=${end}&granularity=DAILY&access_token=${token}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
       console.error("Meta API Error:", data.error);
       return { success: false, adjustments: 0, reason: data.error.message };
    }

    // Process data to find total cost
    let totalMetaCost = 0;
    if (data.data && Array.isArray(data.data.data_points)) {
       data.data.data_points.forEach((point: any) => {
          totalMetaCost += (point.cost || 0);
       });
    }

    // Reconcile Meta's reported cost against what we actually charged this
    // workspace over the same window (our BILLING_DEDUCTED ledger).
    const charges = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: "BILLING_DEDUCTED",
        createdAt: {
          gte: new Date(start * 1000),
          lte: new Date(end * 1000),
        },
      },
      select: { metadata: true },
    });

    const totalCharged = charges.reduce((sum, log) => {
      const amount = (log.metadata as { amount?: number } | null)?.amount;
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);

    // If Meta billed more than we charged, we under-collected — deduct the
    // difference. If we over-charged, refund it. Positive = credit the wallet.
    const adjustmentAmount = Number((totalCharged - totalMetaCost).toFixed(4));

    // Ignore sub-cent noise from floating point / rounding.
    if (Math.abs(adjustmentAmount) >= 0.01) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { walletBalance: { increment: adjustmentAmount } }
      });

      await logAuditEvent(workspaceId, "BILLING_RECONCILIATION", "SYSTEM", {
        metaReportedCost: totalMetaCost,
        totalCharged,
        adjustment: adjustmentAmount,
        note: "Automated reconciliation against Meta conversation analytics"
      });
    }

    return { success: true, adjustments: adjustmentAmount };
  } catch (error: any) {
    console.error("Reconciliation Error:", error);
    return { success: false, adjustments: 0, reason: "Failed to connect to Meta API" };
  }
}
