import { prisma } from "@tickerpro/database/client";
import { chatCompletion, isAIConfigured, type ChatMessage } from "./ai-gateway.js";

/** Render stored message content (JSON blob) into plain text for the LLM. */
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  const c = content as { text?: string; mediaUrl?: string } | null;
  if (c?.text) return c.text;
  if (c?.mediaUrl) return "[media]";
  return "";
}

/**
 * Summarize a conversation. Uses the configured LLM (Ollama/OpenAI) when
 * available; otherwise returns a deterministic fallback so local dev and demos
 * still work without a model.
 */
export async function summarizeConversation(conversationId: string): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
  });

  if (!conversation) throw new Error("Conversation not found");

  const transcript = conversation.messages
    .map((m) => `${m.direction === "INBOUND" ? "Customer" : "Agent"}: ${messageText(m.content)}`)
    .filter((l) => l.trim().length > "Customer: ".length)
    .join("\n");

  if (!isAIConfigured() || !transcript) {
    return "✨ AI Summary unavailable — no LLM is configured (set OPENAI_API_BASE for local Ollama).";
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a support assistant. Summarize the WhatsApp conversation below in 3-5 concise bullet points: the customer's intent, key facts, and the recommended next action. Use plain text bullets starting with '- '.",
    },
    { role: "user", content: transcript },
  ];

  const result = await chatCompletion(messages, { temperature: 0.2, maxTokens: 300 });
  return result ? `✨ AI Summary:\n${result}` : "✨ AI Summary unavailable — the model did not respond.";
}

/**
 * Suggest up to 3 context-aware replies for the agent. Falls back to generic
 * suggestions when no LLM is configured.
 */
export async function suggestReplies(conversationId: string): Promise<string[]> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 8 } },
  });

  if (!conversation) throw new Error("Conversation not found");

  const recent = [...conversation.messages]
    .reverse()
    .map((m) => `${m.direction === "INBOUND" ? "Customer" : "Agent"}: ${messageText(m.content)}`)
    .filter((l) => l.trim().length > "Customer: ".length)
    .join("\n");

  if (!isAIConfigured() || !recent) {
    return [
      "Thanks for reaching out! Could you share a few more details so I can help?",
      "I'm looking into this for you right now — one moment please.",
      "Happy to help! Would you prefer a refund or a replacement?",
    ];
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are helping a support agent. Based on the conversation, propose exactly 3 short, professional, ready-to-send reply options. Return ONLY a JSON array of 3 strings, nothing else.",
    },
    { role: "user", content: recent },
  ];

  const result = await chatCompletion(messages, { temperature: 0.5, maxTokens: 300 });
  if (!result) {
    return ["Thanks for your patience — let me check and get right back to you."];
  }

  // The model is asked for a JSON array; parse defensively.
  try {
    const parsed = JSON.parse(result.slice(result.indexOf("["), result.lastIndexOf("]") + 1));
    if (Array.isArray(parsed)) return parsed.map(String).slice(0, 3);
  } catch {
    // Fall through to line-splitting if the model didn't return clean JSON.
  }
  return result
    .split("\n")
    .map((l) => l.replace(/^[\d.)\-\s"]+/, "").replace(/"$/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Score the quality of a closed conversation on a 0–10 scale.
 *
 * Evaluates three dimensions (Wati "AI CX Score" parity):
 *   1. Resolution quality — was the customer's issue actually solved?
 *   2. First-response time — how many minutes until the first agent reply?
 *   3. Agent tone — professional, empathetic, and concise?
 *
 * The result is persisted to `Conversation.cxScore` + `.cxScoreReason`.
 * Falls back to a deterministic score when no LLM is configured.
 */
export async function scoreCxQuality(
  conversationId: string
): Promise<{ score: number; reason: string }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 60 } },
  });

  if (!conversation) throw new Error("Conversation not found");

  // Compute first-response time (minutes from first inbound to first outbound)
  const firstInbound = conversation.messages.find((m) => m.direction === "INBOUND");
  const firstOutbound = conversation.messages.find((m) => m.direction === "OUTBOUND");
  let firstResponseMinutes: number | null = null;
  if (firstInbound && firstOutbound) {
    firstResponseMinutes = Math.round(
      (firstOutbound.createdAt.getTime() - firstInbound.createdAt.getTime()) / 60_000
    );
  }

  const transcript = conversation.messages
    .map((m) => `${m.direction === "INBOUND" ? "Customer" : "Agent"}: ${messageText(m.content)}`)
    .filter((l) => l.trim().length > "Customer: ".length)
    .join("\n");

  // Fallback when no LLM is available
  if (!isAIConfigured() || !transcript) {
    const fallbackScore = 7.0;
    const fallbackReason =
      "AI scoring unavailable — LLM not configured. Default score assigned.";
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { cxScore: fallbackScore, cxScoreReason: fallbackReason },
    });
    return { score: fallbackScore, reason: fallbackReason };
  }

  const frtText =
    firstResponseMinutes !== null
      ? `First agent response arrived in ${firstResponseMinutes} minute(s).`
      : "First response time could not be determined.";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a customer experience quality evaluator. Score the following support conversation on a scale of 0–10 (10 = exceptional).

Evaluate these three dimensions equally:
1. Resolution quality — was the customer's issue fully resolved?
2. First-response time — respond faster = higher score. Context: ${frtText}
3. Agent tone — professional, empathetic, and concise?

Return ONLY valid JSON in this exact shape (no markdown, no extra text):
{"score": <number 0-10, one decimal>, "reason": "<one sentence summary of why>"}`,
    },
    { role: "user", content: transcript },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.1, maxTokens: 150 });

  let score = 6.5;
  let reason = "Score could not be parsed from LLM response.";

  if (raw) {
    try {
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd)) as {
        score?: unknown;
        reason?: unknown;
      };
      if (typeof parsed.score === "number" && parsed.score >= 0 && parsed.score <= 10) {
        score = Math.round(parsed.score * 10) / 10;
      }
      if (typeof parsed.reason === "string" && parsed.reason.trim()) {
        reason = parsed.reason.trim();
      }
    } catch {
      // Keep defaults if parsing fails
    }
  }

  // Persist to DB
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { cxScore: score, cxScoreReason: reason },
  });

  return { score, reason };
}
