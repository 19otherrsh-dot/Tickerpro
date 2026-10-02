import type { CrmConnector, CrmContact, CrmSyncResult } from "./crm.js";

/**
 * Salesforce connector. Uses the REST API (sObjects) over fetch.
 * Requires per-workspace credentials: SALESFORCE_INSTANCE_URL + an access token.
 * When unconfigured it no-ops gracefully (so dev/demo doesn't fail).
 */
export const salesforceConnector: CrmConnector = {
  id: "salesforce",
  label: "Salesforce",

  isConfigured() {
    return Boolean(process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN);
  },

  async syncContact(workspaceId: string, contact: CrmContact): Promise<CrmSyncResult> {
    if (!this.isConfigured()) {
      return { success: false, skipped: true, error: "Salesforce not configured" };
    }
    const url = `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v60.0/sobjects/Contact`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          LastName: contact.name || contact.phoneNumber,
          Phone: contact.phoneNumber,
          Email: contact.email,
          Description: `Synced from TickerPro (workspace ${workspaceId})`,
        }),
      });
      if (!res.ok) return { success: false, error: `Salesforce ${res.status}: ${await res.text()}` };
      const data = (await res.json()) as { id?: string };
      return { success: true, externalId: data.id };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Salesforce request failed" };
    }
  },
};
