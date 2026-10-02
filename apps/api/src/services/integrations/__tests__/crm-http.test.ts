import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { salesforceConnector } from "../salesforce.js";
import { zohoConnector } from "../zoho.js";

const ORIGINAL_ENV = { ...process.env };
const originalFetch = globalThis.fetch;
const contact = { phoneNumber: "+15551234567", name: "Jane Doe", email: "jane@example.com" };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("salesforceConnector", () => {
  it("skips (does not call the API) when unconfigured", async () => {
    delete process.env.SALESFORCE_INSTANCE_URL;
    delete process.env.SALESFORCE_ACCESS_TOKEN;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    const res = await salesforceConnector.syncContact("ws_1", contact);
    expect(res.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs a Contact sObject with a bearer token when configured", async () => {
    process.env.SALESFORCE_INSTANCE_URL = "https://na1.salesforce.com";
    process.env.SALESFORCE_ACCESS_TOKEN = "sf_tok";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "003XYZ" }) }) as any;

    const res = await salesforceConnector.syncContact("ws_1", contact);

    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain("/services/data/");
    expect(url).toContain("/sobjects/Contact");
    expect(init.headers.Authorization).toBe("Bearer sf_tok");
    const body = JSON.parse(init.body);
    expect(body.Phone).toBe(contact.phoneNumber);
    expect(body.Email).toBe(contact.email);
    expect(res).toEqual({ success: true, externalId: "003XYZ" });
  });

  it("returns an error result on a non-2xx response", async () => {
    process.env.SALESFORCE_INSTANCE_URL = "https://na1.salesforce.com";
    process.env.SALESFORCE_ACCESS_TOKEN = "sf_tok";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad token" }) as any;

    const res = await salesforceConnector.syncContact("ws_1", contact);
    expect(res.success).toBe(false);
    expect(res.error).toContain("401");
  });
});

describe("zohoConnector", () => {
  beforeEach(() => {
    process.env.ZOHO_API_DOMAIN = "https://www.zohoapis.com";
    process.env.ZOHO_ACCESS_TOKEN = "zoho_tok";
  });

  it("POSTs a Contacts record with the Zoho oauth header", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ details: { id: "ZC1" } }] }) }) as any;

    const res = await zohoConnector.syncContact("ws_1", contact);

    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain("/crm/v2/Contacts");
    expect(init.headers.Authorization).toBe("Zoho-oauthtoken zoho_tok");
    const body = JSON.parse(init.body);
    expect(body.data[0].Phone).toBe(contact.phoneNumber);
    expect(res).toEqual({ success: true, externalId: "ZC1" });
  });

  it("skips when unconfigured", async () => {
    delete process.env.ZOHO_API_DOMAIN;
    delete process.env.ZOHO_ACCESS_TOKEN;
    const res = await zohoConnector.syncContact("ws_1", contact);
    expect(res.skipped).toBe(true);
  });
});
