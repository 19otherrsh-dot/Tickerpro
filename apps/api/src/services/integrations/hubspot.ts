import type { CrmConnector, CrmContact, CrmSyncResult } from "./crm.js";

const HUBSPOT_API = "https://api.hubapi.com/crm/v3/objects/contacts";

/**
 * Upsert a contact into HubSpot via the CRM v3 API.
 *
 * HubSpot has no phone-based upsert, so we search by phone first and then
 * create or update. Requires HUBSPOT_ACCESS_TOKEN (a private-app token).
 */
export async function syncContactToHubspot(
  workspaceId: string,
  contactData: CrmContact
): Promise<CrmSyncResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return { success: false, skipped: true, error: "HubSpot not configured" };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const properties: Record<string, string> = { phone: contactData.phoneNumber };
  if (contactData.email) properties.email = contactData.email;
  if (contactData.name) {
    const [firstName, ...rest] = contactData.name.trim().split(/\s+/);
    if (firstName) properties.firstname = firstName;
    if (rest.length) properties.lastname = rest.join(" ");
  }

  try {
    // 1. Look for an existing contact with this phone number.
    const searchRes = await fetch(`${HUBSPOT_API}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "phone", operator: "EQ", value: contactData.phoneNumber },
            ],
          },
        ],
        properties: ["phone"],
        limit: 1,
      }),
    });

    if (!searchRes.ok) {
      return { success: false, error: `HubSpot search ${searchRes.status}: ${await searchRes.text()}` };
    }

    const search = (await searchRes.json()) as { results?: Array<{ id: string }> };
    const existingId = search.results?.[0]?.id;

    // 2. Update if found, otherwise create.
    const res = existingId
      ? await fetch(`${HUBSPOT_API}/${existingId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ properties }),
        })
      : await fetch(HUBSPOT_API, {
          method: "POST",
          headers,
          body: JSON.stringify({ properties }),
        });

    if (!res.ok) {
      return { success: false, error: `HubSpot ${res.status}: ${await res.text()}` };
    }

    const data = (await res.json()) as { id?: string };
    return { success: true, externalId: data.id ?? existingId };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "HubSpot request failed" };
  }
}

/** Registry-compatible HubSpot connector. */
export const hubspotConnector: CrmConnector = {
  id: "hubspot",
  label: "HubSpot",
  isConfigured() {
    return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
  },
  syncContact(workspaceId: string, contact: CrmContact): Promise<CrmSyncResult> {
    return syncContactToHubspot(workspaceId, contact);
  },
};
