import crypto from "crypto";

// Evaluated per-call (not cached at module load) so it reflects the current
// environment and stays testable.
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Constant-time comparison of two strings to avoid timing attacks.
 * Returns false (rather than throwing) when lengths differ.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export interface SignatureResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify a Meta (WhatsApp/Messenger/Instagram) webhook signature.
 *
 * Meta signs the *raw* request bytes, so callers MUST pass the raw body
 * exactly as received — never a re-serialized object (key order/whitespace
 * differ and the HMAC will never match).
 *
 * Security posture:
 *  - In production a missing signature header or unset APP secret is rejected
 *    (fail-closed) — otherwise an attacker could bypass verification by simply
 *    omitting the header.
 *  - In non-production we allow unsigned requests so local testing / curl works.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader?: string): SignatureResult {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    if (isProduction()) return { valid: false, reason: "META_APP_SECRET not configured" };
    return { valid: true, reason: "skipped (no secret, non-production)" };
  }

  if (!signatureHeader) {
    if (isProduction()) return { valid: false, reason: "missing signature header" };
    return { valid: true, reason: "skipped (no signature, non-production)" };
  }

  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return { valid: safeEqual(signatureHeader, expected) };
}

/**
 * Verify a Shopify webhook HMAC (base64-encoded SHA256 over the raw body).
 */
export function verifyShopifySignature(rawBody: string, hmacHeader?: string): SignatureResult {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    if (isProduction()) return { valid: false, reason: "SHOPIFY_API_SECRET not configured" };
    return { valid: true, reason: "skipped (no secret, non-production)" };
  }

  if (!hmacHeader) {
    if (isProduction()) return { valid: false, reason: "missing HMAC header" };
    return { valid: true, reason: "skipped (no HMAC, non-production)" };
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return { valid: safeEqual(hmacHeader, expected) };
}

/**
 * Verify a WooCommerce webhook signature (base64 SHA256 HMAC over the raw body,
 * signed with the per-webhook secret in WOOCOMMERCE_WEBHOOK_SECRET).
 */
export function verifyWooCommerceSignature(rawBody: string, signatureHeader?: string): SignatureResult {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

  if (!secret) {
    if (isProduction()) return { valid: false, reason: "WOOCOMMERCE_WEBHOOK_SECRET not configured" };
    return { valid: true, reason: "skipped (no secret, non-production)" };
  }

  if (!signatureHeader) {
    if (isProduction()) return { valid: false, reason: "missing signature header" };
    return { valid: true, reason: "skipped (no signature, non-production)" };
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return { valid: safeEqual(signatureHeader, expected) };
}
