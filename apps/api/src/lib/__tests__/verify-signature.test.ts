import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { verifyMetaSignature, verifyShopifySignature } from "../verify-signature.js";

const ORIGINAL_ENV = { ...process.env };

function metaSig(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = "test_secret";
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts a correctly signed raw body", () => {
    const body = JSON.stringify({ a: 1, b: "x" });
    expect(verifyMetaSignature(body, metaSig("test_secret", body)).valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = metaSig("test_secret", body);
    expect(verifyMetaSignature(JSON.stringify({ a: 2 }), sig).valid).toBe(false);
  });

  it("rejects a missing signature in production (fail-closed)", () => {
    expect(verifyMetaSignature("{}", undefined).valid).toBe(false);
  });

  it("allows a missing signature outside production (dev convenience)", () => {
    process.env.NODE_ENV = "development";
    expect(verifyMetaSignature("{}", undefined).valid).toBe(true);
  });

  it("rejects when secret is unset in production", () => {
    delete process.env.META_APP_SECRET;
    expect(verifyMetaSignature("{}", "sha256=abc").valid).toBe(false);
  });
});

describe("verifyShopifySignature", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = "shopify_secret";
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts a correct base64 HMAC", () => {
    const body = JSON.stringify({ order: 1 });
    const hmac = crypto.createHmac("sha256", "shopify_secret").update(body).digest("base64");
    expect(verifyShopifySignature(body, hmac).valid).toBe(true);
  });

  it("rejects an incorrect HMAC", () => {
    expect(verifyShopifySignature("{}", "not-valid").valid).toBe(false);
  });
});
