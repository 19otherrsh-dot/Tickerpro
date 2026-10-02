import { prisma } from "@tickerpro/database/client";
import { sendMessage } from "./whatsapp.js";

export async function sendCSATSurvey(workspaceId: string, conversationId: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      whatsappNumber: { include: { workspace: true } }
    }
  });

  if (!conversation) return false;

  // CSAT surveys are delivered as a WhatsApp interactive list, so they only
  // apply to WhatsApp conversations (Messenger/Instagram have no WA number).
  const whatsappNumber = conversation.whatsappNumber;
  if (!whatsappNumber) return false;

  const { workspace } = whatsappNumber;
  if (!workspace.csatEnabled) return false;

  const accessToken = process.env.META_ACCESS_TOKEN || "mock_token";

  try {
    const waRes = await sendMessage(
      {
        accessToken,
        phoneNumberId: whatsappNumber.phoneNumber,
        wabaId: whatsappNumber.wabaId,
        webhookVerifyToken: ""
      },
      conversation.contact.phoneNumber,
      {
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "Feedback Request" },
          body: { text: "How would you rate your experience with us today?" },
          footer: { text: "Please select an option below." },
          action: {
            button: "Rate Experience",
            sections: [
              {
                title: "CSAT Score",
                rows: [
                  { id: `csat_${conversationId}_5`, title: "⭐⭐⭐⭐⭐ (5) Excellent" },
                  { id: `csat_${conversationId}_4`, title: "⭐⭐⭐⭐ (4) Good" },
                  { id: `csat_${conversationId}_3`, title: "⭐⭐⭐ (3) Average" },
                  { id: `csat_${conversationId}_2`, title: "⭐⭐ (2) Poor" },
                  { id: `csat_${conversationId}_1`, title: "⭐ (1) Terrible" }
                ]
              }
            ]
          }
        }
      }
    );

    if (waRes.messages && waRes.messages.length > 0) {
      // Create outbound message record for the survey
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          content: { text: "Sent CSAT Survey" },
          status: "SENT",
          waMessageId: waRes.messages?.[0]?.id || `csat_mock_${Date.now()}`
        }
      });
      return true;
    }
  } catch (error) {
    console.error("[CSAT] Failed to send survey", error);
  }

  return false;
}
