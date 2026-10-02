import crypto from "crypto";

// Mirrors verifyMetaSignature in apps/api/src/lib/verify-signature.ts — keep the
// two in sync (this service is a separate package and can't import it).

export interface SignatureResult {
  valid: boolean;
  reason?: string;
}

/** Constant-time comparison; false (rather than throwing) when lengths differ. */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify a Meta webhook signature over the *raw* request body — Meta signs the
 * exact bytes it sent, so a re-serialized object never matches.
 *
 * Fail-closed in production (missing secret or header is rejected, otherwise an
 * attacker could bypass verification by omitting the header); permissive in
 * non-production so local curl testing works.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader?: string): SignatureResult {
  const appSecret = process.env.META_APP_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!appSecret) {
    if (isProduction) return { valid: false, reason: "META_APP_SECRET not configured" };
    return { valid: true, reason: "skipped (no secret, non-production)" };
  }

  if (!signatureHeader) {
    if (isProduction) return { valid: false, reason: "missing signature header" };
    return { valid: true, reason: "skipped (no signature, non-production)" };
  }

  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return { valid: safeEqual(signatureHeader, expected) };
}
