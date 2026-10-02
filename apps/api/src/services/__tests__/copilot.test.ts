import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@tickerpro/database/client";
import { summarizeConversation, suggestReplies } from "../copilot.js";

const ORIGINAL_ENV = { ...process.env };

const fakeConversation = {
  id: "conv_1",
  messages: [
    { direction: "INBOUND", content: { text: "My order arrived broken" }, createdAt: new Date() },
    { direction: "OUTBOUND", content: { text: "So sorry — can you send a photo?" }, createdAt: new Date() },
  ],
};

describe("copilot graceful fallback (no LLM configured)", () => {
  beforeEach(() => {
    // Ensure no model is configured so we exercise the fallback paths only.
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_KEY = "sk-placeholder";
    (prisma.conversation.findUnique as any).mockResolvedValue(fakeConversation);
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  it("returns an 'unavailable' summary instead of throwing", async () => {
    const summary = await summarizeConversation("conv_1");
    expect(summary).toContain("AI Summary");
    expect(summary.toLowerCase()).toContain("unavailable");
  });

  it("returns 3 generic suggested replies", async () => {
    const replies = await suggestReplies("conv_1");
    expect(replies).toHaveLength(3);
    expect(replies.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
  });

  it("throws a clear error when the conversation is missing", async () => {
    (prisma.conversation.findUnique as any).mockResolvedValue(null);
    await expect(summarizeConversation("missing")).rejects.toThrow("Conversation not found");
  });
});
