import { describe, it, expect, vi, beforeEach } from "vitest";
import { openConversationWindow } from "../billing-engine.js";
import { prisma } from "@tickerpro/database/client";

describe("Billing Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if workspace is not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await openConversationWindow("conv_1", "ws_1", "BUSINESS_INITIATED");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Workspace not found");
  });

  it("should allow sending if there is an open 24h conversation window without deducting balance", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws_1",
      walletBalance: 10,
    } as any);

    // Call it once to open the window
    await openConversationWindow("conv_1", "ws_1", "BUSINESS_INITIATED");
    
    // Clear mocks to test second call
    vi.clearAllMocks();

    const result = await openConversationWindow("conv_1", "ws_1", "BUSINESS_INITIATED");
    
    expect(result.allowed).toBe(true);
    // Should NOT deduct from balance on the second call
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it("should deduct balance if opening a new conversation window and balance is sufficient", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws_1",
      walletBalance: 10,
    } as any);

    const result = await openConversationWindow("conv_2", "ws_1", "BUSINESS_INITIATED");

    expect(result.allowed).toBe(true);
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { walletBalance: { decrement: 0.03 } } // cost for BUSINESS_INITIATED
    });
  });

  it("should block sending if opening a new window and balance is insufficient", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws_1",
      walletBalance: 0.01, // Insufficient for $0.03
    } as any);

    const result = await openConversationWindow("conv_3", "ws_1", "BUSINESS_INITIATED");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Insufficient credits. Please top up your wallet.");
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });
});
