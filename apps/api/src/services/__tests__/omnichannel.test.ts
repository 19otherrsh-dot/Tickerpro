import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@tickerpro/database/client";
import { parseChannelWebhook } from "../meta-messaging.js";
import { ingestChannelMessages } from "../omnichannel.js";

// The ingest path calls the Meta Send API for read receipts — stub fetch so no
// network traffic occurs in tests.
const originalFetch = globalThis.fetch;

function messengerBody(text = "hello from messenger") {
  return {
    object: "page",
    entry: [
      {
        id: "PAGE_1",
        messaging: [
          {
            sender: { id: "PSID_1" },
            recipient: { id: "PAGE_1" },
            timestamp: 1700000000000,
            message: { mid: "mid.1", text },
          },
        ],
      },
    ],
  };
}

describe("parseChannelWebhook", () => {
  it("parses a Messenger payload", () => {
    const { channel, messages } = parseChannelWebhook(messengerBody());
    expect(channel).toBe("MESSENGER");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.senderId).toBe("PSID_1");
    expect(messages[0]!.recipientId).toBe("PAGE_1");
    expect(messages[0]!.text).toBe("hello from messenger");
  });

  it("parses an Instagram payload", () => {
    const body = { ...messengerBody("hi from ig"), object: "instagram" };
    const { channel, messages } = parseChannelWebhook(body);
    expect(channel).toBe("INSTAGRAM");
    expect(messages[0]!.text).toBe("hi from ig");
  });

  it("ignores WhatsApp payloads (handled by the WhatsApp path)", () => {
    const { channel, messages } = parseChannelWebhook({ object: "whatsapp_business_account" });
    expect(channel).toBeNull();
    expect(messages).toHaveLength(0);
  });

  it("flags echoes so we don't re-ingest our own outbound messages", () => {
    const body = messengerBody();
    (body.entry[0]!.messaging[0]!.message as any).is_echo = true;
    const { messages } = parseChannelWebhook(body);
    expect(messages[0]!.isEcho).toBe(true);
  });
});

describe("ingestChannelMessages", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
    (prisma.channelAccount.findUnique as any).mockResolvedValue({
      id: "acct_1",
      externalId: "PAGE_1",
      channel: "MESSENGER",
      accessToken: "tok",
      isActive: true,
      workspaceId: "ws_1",
      workspace: { id: "ws_1", autoAssign: false },
    });
    (prisma.contact.findUnique as any).mockResolvedValue(null);
    (prisma.contact as any).create = vi
      .fn()
      .mockResolvedValue({ id: "contact_1", name: null, phoneNumber: "PSID_1" });
    (prisma.conversation.findFirst as any).mockResolvedValue(null);
    (prisma.conversation.create as any).mockResolvedValue({ id: "conv_1", workspaceId: "ws_1" });
    (prisma.conversation.update as any).mockResolvedValue({});
    (prisma.message.create as any).mockResolvedValue({ id: "msg_1" });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("creates contact, conversation and message for a new Messenger sender", async () => {
    const { channel, messages } = parseChannelWebhook(messengerBody());
    await ingestChannelMessages(channel as "MESSENGER", messages);

    // Contact keyed by PSID (these channels have no phone number).
    expect((prisma.contact as any).create).toHaveBeenCalledTimes(1);
    expect((prisma.contact as any).create.mock.calls[0][0].data).toMatchObject({
      phoneNumber: "PSID_1",
      channel: "MESSENGER",
      workspaceId: "ws_1",
    });

    // Conversation bound to the ChannelAccount, not a WhatsApp number.
    expect((prisma.conversation.create as any).mock.calls[0][0].data).toMatchObject({
      channelAccountId: "acct_1",
      channel: "MESSENGER",
      contactId: "contact_1",
    });

    const msg = (prisma.message.create as any).mock.calls[0][0].data;
    expect(msg).toMatchObject({ direction: "INBOUND", channel: "MESSENGER", conversationId: "conv_1" });
    expect((msg.content as any).text).toBe("hello from messenger");
  });

  it("skips echo messages", async () => {
    const body = messengerBody();
    (body.entry[0]!.messaging[0]!.message as any).is_echo = true;
    const { messages } = parseChannelWebhook(body);
    await ingestChannelMessages("MESSENGER", messages);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("skips messages for an unknown channel account", async () => {
    (prisma.channelAccount.findUnique as any).mockResolvedValue(null);
    const { messages } = parseChannelWebhook(messengerBody());
    await ingestChannelMessages("MESSENGER", messages);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
