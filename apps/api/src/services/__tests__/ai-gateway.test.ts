import { describe, it, expect, afterEach } from "vitest";
import { isAIConfigured, chatCompletion, embed } from "../ai-gateway.js";

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
