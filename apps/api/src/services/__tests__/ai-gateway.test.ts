import { describe, it, expect, afterEach } from "vitest";
import {
  isAIConfigured,
  chatCompletion,
  embed,
  embeddingDimensionsParam,
  EMBEDDING_DIMENSIONS,
} from "../ai-gateway.js";

const ORIGINAL_ENV = { ...process.env };

describe("AI gateway configuration", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is not configured with only the placeholder key", () => {
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_KEY = "sk-placeholder";
    expect(isAIConfigured()).toBe(false);
  });

  it("is configured when a base URL (local Ollama) is set", () => {
    process.env.OPENAI_API_BASE = "http://ollama:11434/v1";
    expect(isAIConfigured()).toBe(true);
  });

  it("is configured when a real API key is set", () => {
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_KEY = "sk-realkeyvalue";
    expect(isAIConfigured()).toBe(true);
  });

  it("degrades gracefully (no throw, no network) when unconfigured", async () => {
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_KEY = "sk-placeholder";
    await expect(chatCompletion([{ role: "user", content: "hi" }])).resolves.toBeNull();
    await expect(embed("hello")).resolves.toEqual([]);
  });
});

describe("embedding dimensions", () => {
  it("matches the document_chunks vector(768) column", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });

  it("requests 768 dims from OpenAI text-embedding-3 models", () => {
    expect(embeddingDimensionsParam("text-embedding-3-small")).toEqual({ dimensions: 768 });
    expect(embeddingDimensionsParam("text-embedding-3-large")).toEqual({ dimensions: 768 });
  });

  it("sends no dimensions param to natively-sized local models", () => {
    expect(embeddingDimensionsParam("nomic-embed-text")).toEqual({});
  });
});
