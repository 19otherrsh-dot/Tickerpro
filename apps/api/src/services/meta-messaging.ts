/**
 * Messenger + Instagram Direct messaging via the Meta Graph Send API.
 *
 * WhatsApp has its own client (`whatsapp.ts`) because it uses a different
 * endpoint shape (phone_number_id + `messages` payload). Messenger and Instagram
 * both use the Page-scoped Send API:
 *
 *   POST https://graph.facebook.com/v21.0/{page-id}/messages
 *   { recipient: { id: PSID }, message: { text }, messaging_type: "RESPONSE" }
 *
 * Instagram messaging is sent through the linked Facebook Page, so both channels
 * share this code path — only the account id differs.
 */
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface ChannelSendConfig {
  /** Page ID (Messenger) or Instagram account ID. */
  externalId: string;
  accessToken: string;
}

export interface ChannelSendResult {
  messageId?: string;
  recipientId?: string;
}

/** Send a plain text message to a Messenger/Instagram user (by PSID/IGSID). */
export async function sendChannelText(
  config: ChannelSendConfig,
  recipientId: string,
  text: string
): Promise<ChannelSendResult> {
  const res = await fetch(`${GRAPH_BASE}/${config.externalId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Meta Send API] ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { message_id?: string; recipient_id?: string };
  return { messageId: data.message_id, recipientId: data.recipient_id };
}

/** Mark a Messenger/Instagram thread as seen (best-effort). */
export async function markChannelSeen(
  config: ChannelSendConfig,
  recipientId: string
): Promise<void> {
  await fetch(`${GRAPH_BASE}/${config.externalId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: "mark_seen" }),
  }).catch(() => {
    /* read receipts are best-effort — never fail the inbound path */
  });
}

// ── Webhook parsing ─────────────────────────────────────────────────────────

export interface ChannelInboundMessage {
  /** Page-scoped sender id (PSID for Messenger, IGSID for Instagram). */
  senderId: string;
  /** The Page/IG account that received it. */
  recipientId: string;
  messageId: string;
  text: string | null;
  /** Attachment URL, if the user sent media. */
  mediaUrl: string | null;
  timestamp: number;
  isEcho: boolean;
}

/**
 * Parse a Messenger (`object: "page"`) or Instagram (`object: "instagram"`)
 * webhook body into a normalized message list.
 *
 * Both use `entry[].messaging[]` with `sender.id` / `recipient.id`.
 */
export function parseChannelWebhook(body: any): {
  channel: "MESSENGER" | "INSTAGRAM" | null;
  messages: ChannelInboundMessage[];
} {
  const channel =
    body?.object === "instagram" ? "INSTAGRAM" : body?.object === "page" ? "MESSENGER" : null;
  if (!channel) return { channel: null, messages: [] };

  const messages: ChannelInboundMessage[] = [];

  for (const entry of body?.entry ?? []) {
    // Messenger/IG deliver events under `messaging`; some IG payloads use `changes`.
    const events = entry?.messaging ?? entry?.standby ?? [];
    for (const event of events) {
      const msg = event?.message;
      if (!msg) continue; // ignore delivery/read/postback-only events

      const attachment = msg.attachments?.[0];
      messages.push({
        senderId: event.sender?.id,
        recipientId: event.recipient?.id,
        messageId: msg.mid,
        text: msg.text ?? null,
        mediaUrl: attachment?.payload?.url ?? null,
        timestamp: Number(event.timestamp) || Date.now(),
        // Echoes are our own outbound messages reflected back — skip them.
        isEcho: Boolean(msg.is_echo),
      });
    }
  }

  return { channel, messages };
}
