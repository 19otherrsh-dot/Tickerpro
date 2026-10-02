import { prisma } from "@tickerpro/database/client";
import { broadcastToWorkspace } from "../routes/ws.js";
import { autoAssignConversation } from "./auto-assign.js";
import { markChannelSeen, type ChannelInboundMessage } from "./meta-messaging.js";

type Channel = "MESSENGER" | "INSTAGRAM";

/**
 * Ingest inbound Messenger / Instagram Direct messages.
 *
 * Mirrors the WhatsApp inbound path but keyed on the Page/IG account
 * (ChannelAccount) and the page-scoped user id (PSID/IGSID) instead of a phone
 * number and WhatsAppNumber.
 */
export async function ingestChannelMessages(
  channel: Channel,
  messages: ChannelInboundMessage[],
  log?: { info: (msg: string) => void; warn: (msg: string) => void }
): Promise<void> {
  for (const msg of messages) {
    // Echoes are our own outbound messages reflected back by Meta.
    if (msg.isEcho || !msg.senderId || !msg.recipientId) continue;

    // The recipient is the Page / IG account that received the message.
    const account = await prisma.channelAccount.findUnique({
      where: { externalId_channel: { externalId: msg.recipientId, channel } },
      include: { workspace: true },
    });

    if (!account || !account.isActive) {
      log?.warn(`[Omnichannel] Unknown/inactive ${channel} account: ${msg.recipientId}`);
      continue;
    }

    // Contacts on these channels have no phone number — the PSID/IGSID is the
    // platform identifier (see Contact.phoneNumber docs in the schema).
    let contact = await prisma.contact.findUnique({
      where: {
        phoneNumber_workspaceId: {
          phoneNumber: msg.senderId,
          workspaceId: account.workspaceId,
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          workspaceId: account.workspaceId,
          phoneNumber: msg.senderId,
          channel,
          leadStage: "NEW",
        },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channelAccountId: account.id,
        status: { not: "CLOSED" },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          workspaceId: account.workspaceId,
          channelAccountId: account.id,
          channel,
          status: "OPEN",
          lastMessageAt: new Date(),
        },
      });

      broadcastToWorkspace(account.workspaceId, {
        type: "conversation:new",
        payload: { conversation, contact },
        timestamp: new Date().toISOString(),
      });

      if (account.workspace.autoAssign) {
        const assignedAgentId = await autoAssignConversation(account.workspaceId, conversation.id);
        if (assignedAgentId) {
          broadcastToWorkspace(account.workspaceId, {
            type: "conversation:assigned",
            payload: { conversationId: conversation.id, assignedAgentId },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        channel,
        type: msg.mediaUrl ? "IMAGE" : "TEXT",
        content: { text: msg.text, mediaUrl: msg.mediaUrl },
        status: "DELIVERED",
        waMessageId: msg.messageId,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(msg.timestamp), isUnread: true },
    });

    broadcastToWorkspace(account.workspaceId, {
      type: "message:new",
      payload: {
        message: newMessage,
        conversationId: conversation.id,
        contact: { id: contact.id, name: contact.name, phone: contact.phoneNumber },
      },
      timestamp: new Date().toISOString(),
    });

    log?.info(`[Omnichannel] ${channel} message from ${msg.senderId}`);

    // Best-effort read receipt.
    markChannelSeen(
      { externalId: account.externalId, accessToken: account.accessToken },
      msg.senderId
    ).catch(() => {});
  }
}
