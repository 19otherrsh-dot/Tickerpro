import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { webhookRoutes } from "../webhooks.js";
import { prisma } from "@tickerpro/database/client";

vi.mock("kafkajs", () => {
  const mockSend = vi.fn();
  return {
    Kafka: vi.fn(() => ({
      producer: () => ({
        connect: vi.fn(),
        send: mockSend,
        disconnect: vi.fn(),
      })
    }))
  };
});

describe("Webhooks API", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = Fastify();
    app.register(webhookRoutes, { prefix: "/api/webhooks" });
  });

  it("should respond to Meta webhook verification challenge", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/webhooks/meta?hub.mode=subscribe&hub.challenge=123456&hub.verify_token=tickerpro-webhook-verify",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("123456");
  });

  it("should reject Meta webhook verification with invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/webhooks/meta?hub.mode=subscribe&hub.challenge=123456&hub.verify_token=WRONG_TOKEN",
    });

    expect(response.statusCode).toBe(403);
  });

  it("should accept valid POST events and push to Kafka", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "123", changes: [] }]
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/meta",
      payload,
    });

    expect(response.statusCode).toBe(200);
    // Since we mock Kafka, it won't crash and returns 200 EVENT_RECEIVED
    expect(response.body).toBe("EVENT_RECEIVED");
  });

  it("should record a WhatsApp catalog 'order' message as an ecom order", async () => {
    // Wire up the prisma calls the order path touches.
    (prisma.whatsAppNumber as any).findFirst = vi.fn().mockResolvedValue({
      id: "wa_1",
      wabaId: "PHONE_1",
      workspaceId: "ws_1",
      workspace: { id: "ws_1", autoAssign: false, businessHours: null, awayMessage: null },
    });
    (prisma.contact.findUnique as any).mockResolvedValue({
      id: "contact_1",
      name: "Buyer",
      phoneNumber: "15551234567",
    });
    (prisma.conversation.findFirst as any).mockResolvedValue({ id: "conv_1", workspaceId: "ws_1" });
    (prisma.message.create as any).mockResolvedValue({ id: "msg_1" });
    (prisma.conversation.update as any).mockResolvedValue({});
    (prisma as any).ecomOrder = { create: vi.fn().mockResolvedValue({ id: "order_1" }) };

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PHONE_1" },
                messages: [
                  {
                    from: "15551234567",
                    id: "wamid.ORDER1",
                    timestamp: "1700000000",
                    type: "order",
                    order: {
                      catalog_id: "cat_1",
                      product_items: [
                        { product_retailer_id: "p1", quantity: "2", item_price: "20", currency: "USD" },
                        { product_retailer_id: "p2", quantity: "1", item_price: "10", currency: "USD" },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await app.inject({ method: "POST", url: "/api/webhooks/meta", payload });
    expect(response.statusCode).toBe(200);

    // Processing happens after the 200 is sent (Meta requires an immediate ack),
    // so let the fire-and-forget microtasks settle before asserting.
    await new Promise((r) => setTimeout(r, 50));

    expect((prisma as any).ecomOrder.create).toHaveBeenCalledTimes(1);
    const arg = (prisma as any).ecomOrder.create.mock.calls[0][0].data;
    expect(arg.totalAmount).toBe(50); // 20*2 + 10*1
    expect(arg.currency).toBe("USD");
    expect(arg.status).toBe("PENDING_PAYMENT");
    expect(arg.externalOrderId).toBe("wa-wamid.ORDER1");
    expect(arg.workspaceId).toBe("ws_1");
    expect(arg.contactId).toBe("contact_1");
  });
});
