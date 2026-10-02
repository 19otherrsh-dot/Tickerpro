import OpenAI from "openai";

/**
 * Single entry point for all LLM access in the API.
 *
 * Previously AI was split between `ai.ts` (real OpenAI/Ollama for RAG) and
 * `copilot.ts` (hard-coded mock summaries/replies). This gateway consolidates
 * that: everything goes through one configurable client that points at either
 * OpenAI or a local Ollama/vLLM server via OPENAI_API_BASE.
 *
 * Env:
 *   OPENAI_API_KEY   — key, or "ollama"/any placeholder for local servers
 *   OPENAI_API_BASE  — e.g. http://ollama:11434/v1 to use a local model
 *   OPENAI_MODEL     — chat model (default gpt-4o; e.g. "llama3" for Ollama)
 *   EMBEDDING_MODEL  — embedding model (default text-embedding-3-small)
 */
let _client: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
      // baseURL lets us target a local Ollama/vLLM server instead of OpenAI.
      baseURL: process.env.OPENAI_API_BASE || undefined,
    });
  }
  return _client;
}

/** Whether a real LLM is configured (otherwise callers should degrade gracefully). */
export function isAIConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_BASE ||
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-placeholder")
  );
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

/**
 * Must match `document_chunks.embedding vector(768)`. nomic-embed-text is natively
 * 768-dim; OpenAI's text-embedding-3-* accept a `dimensions` param to match.
 * Fixed-size models of another width (e.g. text-embedding-ada-002) are not supported.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** Only OpenAI's text-embedding-3-* models support (and need) an explicit dimension count. */
export function embeddingDimensionsParam(model: string): { dimensions?: number } {
  return model.startsWith("text-embedding-3") ? { dimensions: EMBEDDING_DIMENSIONS } : {};
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Run a chat completion. Returns null if no model is configured or the call
 * fails, so callers can fall back to a safe default rather than throwing.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  if (!isAIConfigured()) return null;
  try {
    const completion = await getAIClient().chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 500,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[AI Gateway] chatCompletion failed:", err);
    return null;
  }
}

export const VISION_MODEL = process.env.VISION_MODEL || CHAT_MODEL;

/**
 * Run a vision completion over a single image (base64 data URI) plus a prompt.
 * Uses the OpenAI-compatible multimodal message format, which also works with
 * local vision models via Ollama (e.g. llava). Returns null when no vision model
 * is configured or the call fails.
 */
export async function analyzeImage(
  imageDataUri: string,
  prompt: string,
  opts: { maxTokens?: number } = {}
): Promise<string | null> {
  if (!isAIConfigured()) return null;
  try {
    const completion = await getAIClient().chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUri } },
          ] as any,
        },
      ],
      temperature: 0,
      max_tokens: opts.maxTokens ?? 200,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[AI Gateway] analyzeImage failed:", err);
    return null;
  }
}

/** Generate an embedding vector. Returns [] on failure. */
export async function embed(text: string): Promise<number[]> {
  if (!isAIConfigured()) return [];
  try {
    const res = await getAIClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      ...embeddingDimensionsParam(EMBEDDING_MODEL),
    });
    const vector = res.data[0]?.embedding ?? [];
    if (vector.length && vector.length !== EMBEDDING_DIMENSIONS) {
      console.error(
        `[AI Gateway] ${EMBEDDING_MODEL} returned ${vector.length} dims; expected ${EMBEDDING_DIMENSIONS}. ` +
          "Use nomic-embed-text or a text-embedding-3-* model."
      );
      return [];
    }
    return vector;
  } catch (err) {
    console.error("[AI Gateway] embed failed:", err);
    return [];
  }
}
