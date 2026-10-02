import { describe, it, expect, afterEach } from "vitest";
import { getCrmConnector, listCrmConnectors, syncContactToCrm } from "../crm.js";

const ORIGINAL_ENV = { ...process.env };

describe("CRM connector registry", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("registers hubspot, salesforce and zoho", () => {
    const ids = listCrmConnectors().map((c) => c.id).sort();
    expect(ids).toEqual(["hubspot", "salesforce", "zoho"]);
  });

  it("resolves a connector case-insensitively", () => {
    expect(getCrmConnector("SALESFORCE")?.id).toBe("salesforce");
    expect(getCrmConnector("nope")).toBeUndefined();
  });

  it("reports unconfigured connectors as not configured", () => {
    delete process.env.SALESFORCE_INSTANCE_URL;
    delete process.env.SALESFORCE_ACCESS_TOKEN;
    const sf = listCrmConnectors().find((c) => c.id === "salesforce");
    expect(sf?.configured).toBe(false);
  });

  it("skips (does not throw) when syncing to an unconfigured CRM", async () => {
    delete process.env.ZOHO_API_DOMAIN;
    delete process.env.ZOHO_ACCESS_TOKEN;
    const res = await syncContactToCrm("zoho", "ws_1", { phoneNumber: "+10000000000" });
    expect(res.success).toBe(false);
    expect(res.skipped).toBe(true);
  });

  it("errors on an unknown CRM id", async () => {
    const res = await syncContactToCrm("salesfarce", "ws_1", { phoneNumber: "+1" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unknown CRM/);
  });
});
