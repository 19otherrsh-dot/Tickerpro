import { prisma } from "@tickerpro/database/client";
import { analyzeImage, isAIConfigured } from "./ai-gateway.js";
import { downloadMedia } from "./whatsapp.js";

export interface MatchedProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  retailerId: string;
  score: number;
}

/**
 * Score how well a free-text image description matches a product, using simple
 * token overlap against the product name + description. Deterministic and
 * dependency-free — good enough to rank catalog items and fully unit-testable.
 */
export function scoreProductMatch(description: string, product: { name: string; description?: string | null }): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

  const descTokens = new Set(norm(description));
  if (descTokens.size === 0) return 0;

  const productTokens = norm(`${product.name} ${product.description ?? ""}`);
  if (productTokens.length === 0) return 0;

  let hits = 0;
  for (const t of productTokens) if (descTokens.has(t)) hits++;
  // Normalize by product token count so short names aren't unfairly penalized.
  return hits / productTokens.length;
}

/**
 * Rank a workspace's catalog products against a free-text image description.
 * Pure/testable; the vision + media I/O lives in matchProductFromImage.
 */
export function rankProducts(
  description: string,
  products: Array<{ id: string; name: string; description: string | null; price: number; currency: string; imageUrl: string | null; retailerId: string }>,
  limit = 3
): MatchedProduct[] {
  return products
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      imageUrl: p.imageUrl,
      retailerId: p.retailerId,
      score: scoreProductMatch(description, p),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const PROMPT =
  "You are a retail product identifier. Describe the main product in this image in 8-15 words: its category, type, color, and any visible brand or defining features. Output only the description.";

/**
 * Identify catalog products from a customer-sent WhatsApp image.
 *
 * Pipeline: download the media bytes from Meta → base64 → vision model to get a
 * text description → rank the workspace catalog by token overlap. Returns [] and
 * never throws if AI/media is unavailable, so the inbound path degrades cleanly.
 */
export async function matchProductFromImage(
  workspaceId: string,
  mediaId: string,
  accessToken: string
): Promise<{ description: string | null; matches: MatchedProduct[] }> {
  if (!isAIConfigured() || !accessToken) return { description: null, matches: [] };

  try {
    // 1. Resolve the Meta CDN URL, then fetch the bytes (needs the bearer token).
    const media = await downloadMedia(accessToken, mediaId);
    if (!media?.url) return { description: null, matches: [] };

    const bytesRes = await fetch(media.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!bytesRes.ok) return { description: null, matches: [] };

    const buf = Buffer.from(await bytesRes.arrayBuffer());
    const dataUri = `data:${media.mimeType || "image/jpeg"};base64,${buf.toString("base64")}`;

    // 2. Describe the product in the image.
    const description = await analyzeImage(dataUri, PROMPT);
    if (!description) return { description: null, matches: [] };

    // 3. Rank the workspace catalog against that description.
    const products = await prisma.metaProduct.findMany({
      where: { catalog: { workspaceId }, availability: "in stock" },
      select: { id: true, name: true, description: true, price: true, currency: true, imageUrl: true, retailerId: true },
    });

    return { description, matches: rankProducts(description, products) };
  } catch (err) {
    console.error("[Product Vision] matchProductFromImage failed:", err);
    return { description: null, matches: [] };
  }
}

/**
 * Add a matched product to the contact's open cart (create the cart if needed).
 * Mirrors the "add to cart from a photo" flow. Returns the cart total.
 */
export async function addProductToCart(
  workspaceId: string,
  contactId: string,
  product: MatchedProduct
): Promise<{ total: number; currency: string }> {
  const existing = await prisma.ecomCart.findFirst({
    where: { workspaceId, contactId, recovered: false },
    orderBy: { createdAt: "desc" },
  });

  const item = {
    productId: product.id,
    retailerId: product.retailerId,
    name: product.name,
    price: product.price,
    quantity: 1,
  };

  if (existing) {
    const items = [...((existing.items as any[]) || []), item];
    const total = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
    await prisma.ecomCart.update({ where: { id: existing.id }, data: { items, totalAmount: total } });
    return { total, currency: existing.currency };
  }

  await prisma.ecomCart.create({
    data: {
      externalCartId: `wa-vision-${Date.now()}`,
      workspaceId,
      contactId,
      totalAmount: product.price,
      currency: product.currency,
      items: [item],
    },
  });
  return { total: product.price, currency: product.currency };
}
