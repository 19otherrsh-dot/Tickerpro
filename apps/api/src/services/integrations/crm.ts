/**
 * Generic CRM connector contract + registry.
 *
 * Lets the app sync contacts to any supported CRM through one interface.
 * Add a new CRM by implementing CrmConnector and registering it below.
 */
export interface CrmContact {
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
}

export interface CrmSyncResult {
  success: boolean;
  externalId?: string;
  /** True when the connector is not configured and the sync was a no-op. */
  skipped?: boolean;
  error?: string;
}

export interface CrmConnector {
  readonly id: string;
  readonly label: string;
  /** Whether credentials/env for this connector are present. */
  isConfigured(): boolean;
  syncContact(workspaceId: string, contact: CrmContact): Promise<CrmSyncResult>;
}

import { salesforceConnector } from "./salesforce.js";
import { zohoConnector } from "./zoho.js";
import { hubspotConnector } from "./hubspot.js";

const registry: Record<string, CrmConnector> = {
  [hubspotConnector.id]: hubspotConnector,
  [salesforceConnector.id]: salesforceConnector,
  [zohoConnector.id]: zohoConnector,
};

export function getCrmConnector(id: string): CrmConnector | undefined {
  return registry[id.toLowerCase()];
}

export function listCrmConnectors(): Array<{ id: string; label: string; configured: boolean }> {
  return Object.values(registry).map((c) => ({
    id: c.id,
    label: c.label,
    configured: c.isConfigured(),
  }));
}

/** Sync a contact to a specific CRM by id. */
export function syncContactToCrm(
  crmId: string,
  workspaceId: string,
  contact: CrmContact
): Promise<CrmSyncResult> {
  const connector = getCrmConnector(crmId);
  if (!connector) {
    return Promise.resolve({ success: false, error: `Unknown CRM connector: ${crmId}` });
  }
  return connector.syncContact(workspaceId, contact);
}
