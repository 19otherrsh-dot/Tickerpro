import type { CrmConnector, CrmContact, CrmSyncResult } from "./crm.js";

/**
 * Zoho CRM connector. Uses the Zoho CRM v2 REST API over fetch.
 * Requires ZOHO_API_DOMAIN (e.g. https://www.zohoapis.com) + an OAuth token.
 */
export const zohoConnector: CrmConnector = {
  id: "zoho",
  label: "Zoho CRM",

  isConfigured() {
    return Boolean(process.env.ZOHO_API_DOMAIN && process.env.ZOHO_ACCESS_TOKEN);
  },

  async syncContact(workspaceId: string, contact: CrmContact): Promise<CrmSyncResult> {
    if (!this.isConfigured()) {
      return { success: false, skipped: true, error: "Zoho not configured" };
    }
    const url = `${process.env.ZOHO_API_DOMAIN}/crm/v2/Contacts`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [
            {
              Last_Name: contact.name || contact.phoneNumber,
              Phone: contact.phoneNumber,
              Email: contact.email,
              Description: `Synced from TickerPro (workspace ${workspaceId})`,
            },
          ],
        }),
      });
      if (!res.ok) return { success: false, error: `Zoho ${res.status}: ${await res.text()}` };
      const body = (await res.json()) as { data?: Array<{ details?: { id?: string } }> };
      return { success: true, externalId: body.data?.[0]?.details?.id };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Zoho request failed" };
    }
  },
};
