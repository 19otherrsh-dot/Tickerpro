import { prisma } from "@tickerpro/database/client";

export class HubSpotService {
  private workspaceId: string;
  private apiKey: string | null = null;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  async init() {
    const integration = await prisma.integration.findFirst({
      where: {
        workspaceId: this.workspaceId,
        type: "HUBSPOT",
        isActive: true,
      },
    });

    if (integration && (integration.config as any)?.apiKey) {
      this.apiKey = (integration.config as any).apiKey;
      return true;
    }
    return false;
  }

  private async request(method: string, endpoint: string, body?: any) {
    if (!this.apiKey) throw new Error("HubSpot API key not configured");

    const url = `https://api.hubapi.com${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HubSpot] Error ${response.status}: ${errorText}`);
      throw new Error(`HubSpot API Error: ${response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) return null;
    return response.json();
  }

  async syncContact(phoneNumber: string, name?: string, email?: string) {
    try {
      // 1. Check if contact exists by phone number
      const searchRes = await this.request("POST", "/crm/v3/objects/contacts/search", {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "phone",
                operator: "EQ",
                value: phoneNumber,
              },
            ],
          },
        ],
        properties: ["hs_object_id", "phone", "firstname", "lastname", "email"],
      });

      let contactId: string;
      const [firstName, ...lastNames] = (name || "").split(" ");
      const lastName = lastNames.join(" ");

      if (searchRes.total > 0) {
        // Update existing
        contactId = searchRes.results[0].id;
        const properties: any = {};
        if (name) {
          properties.firstname = firstName;
          properties.lastname = lastName;
        }
        if (email) properties.email = email;

        if (Object.keys(properties).length > 0) {
          await this.request("PATCH", `/crm/v3/objects/contacts/${contactId}`, { properties });
        }
      } else {
        // Create new
        const createRes = await this.request("POST", "/crm/v3/objects/contacts", {
          properties: {
            phone: phoneNumber,
            firstname: firstName || "WhatsApp User",
            lastname: lastName || "",
            email: email || "",
            hs_lead_status: "NEW",
          },
        });
        contactId = createRes.id;
      }
      return contactId;
    } catch (err) {
      console.error("[HubSpot] Failed to sync contact", err);
      return null;
    }
  }

  async addConversationNote(contactId: string, summary: string, sentiment?: string) {
    try {
      const noteBody = `<strong>TickerPro Conversation Closed</strong><br/>Sentiment: ${sentiment || 'N/A'}<br/><br/>Summary:<br/>${summary}`;
      
      // Create Note engagement
      const noteRes = await this.request("POST", "/crm/v3/objects/notes", {
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString(),
        },
      });

      // Associate Note with Contact
      await this.request("PUT", `/crm/v3/objects/notes/${noteRes.id}/associations/contacts/${contactId}/note_to_contact`);
      
      return true;
    } catch (err) {
      console.error("[HubSpot] Failed to add note", err);
      return false;
    }
  }
}
