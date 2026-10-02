import { prisma } from "@tickerpro/database/client";
import { chatCompletion, embed, type ChatMessage } from "./ai-gateway.js";

/**
 * Generate a vector embedding for a piece of text.
 * Delegates to the shared AI gateway so it honors OPENAI_API_BASE (Ollama/vLLM).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return embed(text);
}

const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE", "CHURN_RISK"] as const;
export type SentimentLabel = (typeof SENTIMENTS)[number];

/**
 * Classify the sentiment of a conversation via the LLM. Consolidates what used
 * to be a call out to the Python ai-service `/sentiment` endpoint onto the Node
 * AI gateway. Degrades to NEUTRAL/0 when no model is configured or on error.
 */
export async function analyzeSentiment(
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ sentiment: SentimentLabel; score: number }> {
  const transcript = history
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .filter((l) => l.trim().length > "Customer: ".length)
    .join("\n");

  if (!transcript) return { sentiment: "NEUTRAL", score: 0 };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        'Classify the customer sentiment of this conversation. Respond with ONLY a JSON object: {"sentiment": one of "POSITIVE"|"NEUTRAL"|"NEGATIVE"|"CHURN_RISK", "score": a number from -1.0 (very negative) to 1.0 (very positive)}. No other text.',
    },
    { role: "user", content: transcript },
  ];

  const result = await chatCompletion(messages, { temperature: 0, maxTokens: 60 });
  if (!result) return { sentiment: "NEUTRAL", score: 0 };

  try {
    const parsed = JSON.parse(result.slice(result.indexOf("{"), result.lastIndexOf("}") + 1));
    const sentiment = SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "NEUTRAL";
    const score = typeof parsed.score === "number" ? Math.max(-1, Math.min(1, parsed.score)) : 0;
    return { sentiment, score };
  } catch {
    return { sentiment: "NEUTRAL", score: 0 };
  }
}

/**
 * Query the workspace's knowledge base for relevant chunks.
 */
export async function queryKnowledgeBase(workspaceId: string, query: string, limit = 3): Promise<string[]> {
  try {
    const embedding = await generateEmbedding(query);
    if (!embedding.length) return []; // AI not configured or embedding failed

    // Convert number[] to a string format that pgvector expects: '[0.1, 0.2, ...]'
    const embeddingStr = `[${embedding.join(",")}]`;

    // Perform vector similarity search using pgvector's cosine distance operator (<=>)
    const results = await prisma.$queryRaw<Array<{ content: string; similarity: number }>>`
      SELECT 
        dc.content, 
        1 - (dc.embedding <=> ${embeddingStr}::vector) as similarity
      FROM document_chunks dc
      JOIN knowledge_bases kb ON dc.knowledge_base_id = kb.id
      WHERE kb.workspace_id = ${workspaceId} 
        AND kb.status = 'COMPLETED'
      ORDER BY dc.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit};
    `;

    // Filter by a basic similarity threshold (e.g. > 0.3)
    return results
      .filter(r => r.similarity > 0.3)
      .map(r => r.content);

  } catch (err) {
    console.error("[AI Service] Error querying knowledge base:", err);
    return [];
  }
}

/**
 * Generate a response using OpenAI, augmented with the knowledge base.
 */
export async function generateAIResponse(
  workspaceId: string, 
  userMessage: string, 
  conversationHistory: { role: "user" | "assistant" | "system", content: string }[] = []
): Promise<string> {
  // 1. Retrieve relevant context from KB
  const contextChunks = await queryKnowledgeBase(workspaceId, userMessage);
  
  const systemPrompt = `You are a helpful customer support assistant for a business.
Answer the user's questions based ONLY on the provided context.
If the answer cannot be found in the context, politely state that you don't have that information.
Keep your responses concise, professional, and friendly.

Context Information:
${contextChunks.length > 0 ? contextChunks.join("\n\n---\n\n") : "No specific context available."}
`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage }
  ];

  const result = await chatCompletion(messages, { temperature: 0.3, maxTokens: 500 });
  return result || "I'm sorry, I couldn't process your request.";
}
