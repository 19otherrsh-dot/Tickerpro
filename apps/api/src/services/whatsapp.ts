/**
 * Meta WhatsApp Cloud API Integration
 *
 * Handles:
 *   - Sending text, template, media, and interactive messages
 *   - Processing inbound webhooks (messages, statuses, errors)
 *   - Phone number verification and registration
 *   - Template management via Meta Graph API
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface SendMessagePayload {
  phoneNumberId: string;
  to: string;
  type: "text" | "template" | "image" | "video" | "document" | "audio" | "interactive";
  text?: { body: string; preview_url?: boolean };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
  image?: { link: string; caption?: string };
  video?: { link: string; caption?: string };
  document?: { link: string; filename?: string; caption?: string };
  interactive?: any;
}

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  webhookVerifyToken: string;
}

// ── Send Message ──────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  payload: SendMessagePayload
): Promise<{ success: boolean; waMessageId?: string; error?: string }> {
  try {
    const body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: payload.to,
      type: payload.type,
    };

    switch (payload.type) {
      case "text":
        body.text = payload.text;
        break;
      case "template":
        body.template = payload.template;
        break;
      case "image":
        body.image = payload.image;
        break;
      case "video":
        body.video = payload.video;
        break;
      case "document":
        body.document = payload.document;
        break;
      case "interactive":
        body.interactive = payload.interactive;
        break;
    }

    const res = await fetch(
      `${GRAPH_API_BASE}/${payload.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("[Meta API] Send failed:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send message",
      };
    }

    return {
      success: true,
      waMessageId: data.messages?.[0]?.id,
    };
  } catch (err: any) {
    console.error("[Meta API] Send error:", err.message);
    return { success: false, error: err.message };
  }
}

// ── Send Template Message ─────────────────────────────────────────────

export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[]
) {
  return sendWhatsAppMessage(config, {
    phoneNumberId: config.phoneNumberId,
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

// ── Mark Message as Read ──────────────────────────────────────────────

export async function markAsRead(config: WhatsAppConfig, waMessageId: string) {
  try {
    await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: waMessageId,
      }),
    });
  } catch (err) {
    console.error("[Meta API] Mark as read failed:", err);
  }
}

// ── Download Media ────────────────────────────────────────────────────

export async function downloadMedia(
  accessToken: string,
  mediaId: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    // Step 1: Get media URL
    const metaRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const metaData = await metaRes.json();

    if (!metaData.url) return null;

    return {
      url: metaData.url,
      mimeType: metaData.mime_type,
    };
  } catch (err) {
    console.error("[Meta API] Download media failed:", err);
    return null;
  }
}

// ── Template Management ───────────────────────────────────────────────

export async function createTemplate(
  config: WhatsAppConfig,
  data: {
    name: string;
    category: string;
    language: string;
    components: any[];
  }
) {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${config.wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          category: data.category,
          language: data.language,
          components: data.components,
        }),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error?.message };
    }

    return { success: true, templateId: result.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listTemplates(config: WhatsAppConfig) {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${config.wabaId}/message_templates?limit=100`,
      {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      }
    );
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("[Meta API] List templates failed:", err);
    return [];
  }
}

// ── Webhook Payload Processing ────────────────────────────────────────

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  audio?: { id: string; mime_type: string };
  interactive?: { type: string; button_reply?: any; list_reply?: any };
  context?: {
    from?: string;
    id?: string;
    ad_title?: string;
    ad_id?: string;
  };
  errors?: any[];
}

export interface WebhookStatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: any[];
}

export function parseWebhookPayload(body: any): {
  messages: WebhookMessage[];
  statuses: WebhookStatusUpdate[];
  phoneNumberId: string | null;
} {
  const messages: WebhookMessage[] = [];
  const statuses: WebhookStatusUpdate[] = [];
  let phoneNumberId: string | null = null;

  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        phoneNumberId = value?.metadata?.phone_number_id || null;

        if (value?.messages) {
          messages.push(...value.messages);
        }

        if (value?.statuses) {
          statuses.push(...value.statuses);
        }
      }
    }
  } catch (err) {
    console.error("[Meta API] Webhook parse error:", err);
  }

  return { messages, statuses, phoneNumberId };
}

// ── Convenience wrapper ───────────────────────────────────────────────
// Used by flow-engine, payments, and public-api routes.

export async function sendMessage(
  config: WhatsAppConfig,
  to: string,
  messagePayload: { type: string; text?: { body: string }; template?: any; interactive?: any }
): Promise<{ messages?: Array<{ id: string }> }> {
  const result = await sendWhatsAppMessage(config, {
    phoneNumberId: config.phoneNumberId,
    to,
    type: messagePayload.type as any,
    text: messagePayload.text,
    template: messagePayload.template,
    interactive: messagePayload.interactive,
  });
  if (result.success && result.waMessageId) {
    return { messages: [{ id: result.waMessageId }] };
  }
  return { messages: [] };
}

// ── Commerce Messaging ────────────────────────────────────────────────

export async function sendCatalogMessage(
  config: WhatsAppConfig,
  to: string,
  catalogBodyText: string = "Browse our latest products!"
) {
  return sendWhatsAppMessage(config, {
    phoneNumberId: config.phoneNumberId,
    to,
    type: "interactive",
    interactive: {
      type: "catalog_message",
      body: { text: catalogBodyText },
      action: {
        name: "catalog_message",
      },
    },
  });
}

export async function sendProductListMessage(
  config: WhatsAppConfig,
  to: string,
  catalogId: string,
  headerText: string,
  bodyText: string,
  sections: { title: string; product_items: { product_retailer_id: string }[] }[]
) {
  return sendWhatsAppMessage(config, {
    phoneNumberId: config.phoneNumberId,
    to,
    type: "interactive",
    interactive: {
      type: "product_list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        catalog_id: catalogId,
        sections,
      },
    },
  });
}
