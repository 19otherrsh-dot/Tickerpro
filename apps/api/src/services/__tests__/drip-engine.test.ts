import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processDripCampaigns } from "../drip-engine.js";
import { prisma } from "@tickerpro/database/client";
import { sendMessage } from "../whatsapp.js";
import { broadcastToWorkspace } from "../../routes/ws.js";

vi.mock("@tickerpro/database/client", () => ({
  prisma: {
    dripEnrollment: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    message: {
      create: vi.fn()
    }
  }
}));

vi.mock("../whatsapp.js", () => ({
  sendMessage: vi.fn()
}));

vi.mock("../../routes/ws.js", () => ({
  broadcastToWorkspace: vi.fn()
}));

describe("Drip Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should process due enrollments and schedule the next step", async () => {
    const mockEnrollment = {
      id: "enroll_1",
      contactId: "contact_1",
      workspaceId: "ws_1",
      currentStep: 0,
      campaign: {
        steps: [
          { templateName: "abandoned_cart_1", delayHours: 1 },
          { templateName: "abandoned_cart_2", delayHours: 24 }
        ]
      },
      contact: {
        id: "contact_1",
        phoneNumber: "1234567890",
        workspaceId: "ws_1",
        workspace: {
          whatsappNumbers: [{ id: "wa_1", phoneNumberId: "pn_1", wabaId: "waba_1", isActive: true }]
        }
      }
    };

    vi.mocked(prisma.dripEnrollment.findMany).mockResolvedValue([mockEnrollment] as any);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(sendMessage).mockResolvedValue({ messages: [{ id: "msg_1" }] } as any);

    await processDripCampaigns();

    expect(prisma.dripEnrollment.findMany).toHaveBeenCalledTimes(1);
    
    // Should send WhatsApp template
    expect(sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      "1234567890",
      {
        type: "template",
        template: { name: "abandoned_cart_1", language: { code: "en_US" } }
      }
    );

    // Should create a message
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "TEMPLATE", direction: "OUTBOUND" })
    }));

    // Should update enrollment to step 1
    expect(prisma.dripEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "enroll_1" },
      data: expect.objectContaining({
        currentStep: 1,
        nextRunAt: expect.any(Date)
      })
    }));
  });

  it("should mark enrollment as COMPLETED if it was on the last step", async () => {
    const mockEnrollment = {
      id: "enroll_1",
      contactId: "contact_1",
      workspaceId: "ws_1",
      currentStep: 1,
      campaign: {
        steps: [
          { templateName: "abandoned_cart_1", delayHours: 1 },
          { templateName: "abandoned_cart_2", delayHours: 24 }
        ]
      },
      contact: {
        id: "contact_1",
        phoneNumber: "1234567890",
        workspaceId: "ws_1",
        workspace: {
          whatsappNumbers: [{ id: "wa_1", phoneNumberId: "pn_1", wabaId: "waba_1", isActive: true }]
        }
      }
    };

    vi.mocked(prisma.dripEnrollment.findMany).mockResolvedValue([mockEnrollment] as any);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);

    await processDripCampaigns();

    // Sends the second template
    expect(sendMessage).toHaveBeenCalled();

    // Updates to COMPLETED
    expect(prisma.dripEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "enroll_1" },
      data: expect.objectContaining({
        currentStep: 2,
        status: "COMPLETED"
      })
    }));
  });

  it("should safely handle completion if currentStep is already out of bounds", async () => {
    const mockEnrollment = {
      id: "enroll_1",
      currentStep: 2,
      campaign: {
        steps: [
          { templateName: "abandoned_cart_1", delayHours: 1 },
          { templateName: "abandoned_cart_2", delayHours: 24 }
        ]
      }
    };

    vi.mocked(prisma.dripEnrollment.findMany).mockResolvedValue([mockEnrollment] as any);

    await processDripCampaigns();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(prisma.dripEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "enroll_1" },
      data: { status: "COMPLETED" }
    }));
  });
});
