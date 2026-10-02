import { describe, it, expect, afterEach } from "vitest";
import { scoreProductMatch, rankProducts, matchProductFromImage } from "../product-vision.js";

const ORIGINAL_ENV = { ...process.env };

const catalog = [
  { id: "p1", name: "Red Running Shoes", description: "Lightweight athletic sneakers", price: 60, currency: "USD", imageUrl: null, retailerId: "SKU1" },
  { id: "p2", name: "Blue Denim Jacket", description: "Classic denim outerwear", price: 90, currency: "USD", imageUrl: null, retailerId: "SKU2" },
  { id: "p3", name: "Leather Wallet", description: "Brown bifold wallet", price: 40, currency: "USD", imageUrl: null, retailerId: "SKU3" },
];

describe("scoreProductMatch", () => {
  it("scores higher for a closer description", () => {
    const shoeDesc = "a pair of red athletic running sneakers";
    const shoeScore = scoreProductMatch(shoeDesc, catalog[0]!);
    const walletScore = scoreProductMatch(shoeDesc, catalog[2]!);
    expect(shoeScore).toBeGreaterThan(walletScore);
    expect(shoeScore).toBeGreaterThan(0);
  });

  it("returns 0 when there is no token overlap", () => {
    expect(scoreProductMatch("a green ceramic coffee mug", catalog[2]!)).toBe(0);
  });

  it("ignores short/stopword-like tokens and punctuation", () => {
    expect(scoreProductMatch("!!! a an of", catalog[0]!)).toBe(0);
  });
});

describe("rankProducts", () => {
  it("returns the best matches, most relevant first", () => {
    const ranked = rankProducts("blue denim jacket outerwear", catalog);
    expect(ranked[0]!.id).toBe("p2");
    expect(ranked[0]!.score).toBeGreaterThan(0);
  });

  it("filters out zero-score products", () => {
    const ranked = rankProducts("brown leather bifold wallet", catalog);
    expect(ranked.every((p) => p.score > 0)).toBe(true);
    expect(ranked.map((p) => p.id)).toContain("p3");
  });

  it("respects the limit", () => {
    const ranked = rankProducts("shoes jacket wallet denim leather running", catalog, 2);
    expect(ranked.length).toBeLessThanOrEqual(2);
  });

  it("returns empty when nothing matches", () => {
    expect(rankProducts("spaceship rocket engine", catalog)).toEqual([]);
  });
});

describe("matchProductFromImage graceful degradation", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns no matches (and never throws) when no vision model is configured", async () => {
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_KEY = "sk-placeholder";
    const res = await matchProductFromImage("ws_1", "media_1", "token");
    expect(res).toEqual({ description: null, matches: [] });
  });

  it("returns no matches when there is no access token", async () => {
    process.env.OPENAI_API_BASE = "http://ollama:11434/v1";
    const res = await matchProductFromImage("ws_1", "media_1", "");
    expect(res.matches).toEqual([]);
  });
});
