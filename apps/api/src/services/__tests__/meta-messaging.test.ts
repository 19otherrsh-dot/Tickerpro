import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendChannelText, markChannelSeen } from "../meta-messaging.js";

const originalFetch = globalThis.fetch;
const config = { externalId: "PAGE_1", accessToken: "tok_123" };

describe("sendChannelText (Meta Graph Send API)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the page's /messages endpoint with the right payload", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: "mid.abc", recipient_id: "PSID_1" }),
    }) as any;

    const res = await sendChannelText(config, "PSID_1", "hello there");

    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain("/PAGE_1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok_123");

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      recipient: { id: "PSID_1" },
      message: { text: "hello there" },
      messaging_type: "RESPONSE",
    });

    expect(res.messageId).toBe("mid.abc");
  });

  it("throws when Meta rejects the send (so the message is marked FAILED)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Invalid recipient",
    }) as any;

    await expect(sendChannelText(config, "BAD", "hi")).rejects.toThrow(/400.*Invalid recipient/);
  });

  it("markChannelSeen never throws, even if the request fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;
    await expect(markChannelSeen(config, "PSID_1")).resolves.toBeUndefined();
  });
});
