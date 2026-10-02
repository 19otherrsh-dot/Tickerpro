import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@tickerpro/database/client";
import { reconcileBilling } from "../billing-engine.js";

/**
 * Regression tests for the billing reconciliation engine.
 *
 * This code previously hard-coded `adjustmentAmount = -5.00`, silently deducting
 * $5 from EVERY workspace's wallet on every run regardless of Meta's actual
 * reported cost. These tests pin the correct behavior: the adjustment must be
 * derived from (what we charged) - (what Meta billed), and must be zero when the
 * two agree.
 */
const originalFetch = globalThis.fetch;

function mockMetaCost(cost: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ data: { data_points: [{ cost }] } }),
  }) as any;
}

/** Our internal ledger of what we actually charged. */
function mockChargedLedger(amounts: number[]) {
  (prisma.auditLog.findMany as any).mockResolvedValue(
    amounts.map((amount) => ({ metadata: { amount } }))
  );
}

describe("reconcileBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_1",
      metaBusinessId: "biz_1",
      integrations: [{ isActive: true, config: { accessToken: "tok" } }],
    });
    (prisma.workspace.update as any).mockResolvedValue({});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("makes NO adjustment when our charges match Meta's reported cost", async () => {
    mockMetaCost(10);
    mockChargedLedger([4, 6]); // we charged 10 — perfectly reconciled

    const result = await reconcileBilling("ws_1");

    expect(result.success).toBe(true);
    expect(result.adjustments).toBe(0);
    // The old bug deducted $5 here. The wallet must not be touched at all.
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it("deducts the shortfall when Meta billed more than we charged", async () => {
    mockMetaCost(12);
    mockChargedLedger([10]); // under-collected by 2

    const result = await reconcileBilling("ws_1");

    expect(result.adjustments).toBe(-2);
    expect((prisma.workspace.update as any).mock.calls[0][0].data).toEqual({
      walletBalance: { increment: -2 },
    });
  });

  it("refunds the customer when we over-charged relative to Meta", async () => {
    mockMetaCost(8);
    mockChargedLedger([10]); // over-collected by 2 — give it back

    const result = await reconcileBilling("ws_1");

    expect(result.adjustments).toBe(2);
    expect((prisma.workspace.update as any).mock.calls[0][0].data).toEqual({
      walletBalance: { increment: 2 },
    });
  });

  it("ignores sub-cent rounding noise", async () => {
    mockMetaCost(10.001);
    mockChargedLedger([10]); // 0.001 discrepancy — not worth an adjustment

    await reconcileBilling("ws_1");

    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });
});
