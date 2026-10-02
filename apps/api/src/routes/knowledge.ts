import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { SourceType } from "@prisma/client";
import { generateEmbedding } from "../services/ai.js";

interface BaseQuery {
  workspaceId: string;
}

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // ─── List Knowledge Bases ────────────────────────────────────────────────
  fastify.get("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (request: FastifyRequest<{ Querystring: BaseQuery }>, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return { knowledgeBases };
  });

  // ─── Create Knowledge Base (Text/URL) ────────────────────────────────────
  fastify.post("/", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ 
      Querystring: BaseQuery;
      Body: { name: string; sourceType: SourceType; content: string; sourceUrl?: string }
    }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { name, sourceType, content, sourceUrl } = request.body;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!content) return reply.status(400).send({ error: "Content is required for MVP" });

    const kb = await prisma.knowledgeBase.create({
      data: {
        workspaceId,
        name,
        sourceType,
        sourceUrl,
        status: "PROCESSING",
      },
    });

    // Run chunking and embedding asynchronously via AI service
    processKnowledgeBase(kb.id, content, sourceUrl).catch(err => {
      console.error(`Error processing KB ${kb.id}:`, err);
    });

    return { success: true, knowledgeBase: kb };
  });

  // ─── Delete Knowledge Base ───────────────────────────────────────────────
  fastify.delete("/:id", { preValidation: [(fastify as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: BaseQuery }>,
    reply
  ) => {
    const { workspaceId } = request.query;
    const { id } = request.params;

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });

    await prisma.knowledgeBase.deleteMany({
      where: { id, workspaceId },
    });

    return { success: true };
  });
}

/**
 * Orchestrates knowledge base ingestion by passing it off to the Python AI service.
 */
async function processKnowledgeBase(kbId: string, content: string, sourceUrl?: string) {
  try {
    const payload = sourceUrl ? { kb_id: kbId, url: sourceUrl } : { kb_id: kbId, content: content };
    
    // Attempt local dev URL first, fallback to docker network
    const aiRes = await fetch("http://localhost:8000/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => fetch("http://ai-service:8000/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));

    if (!aiRes.ok) {
      throw new Error(`AI service responded with ${aiRes.status}`);
    }

    // Note: AI service will update the DB status to COMPLETED when background task finishes

  } catch (error) {
    console.error(`Failed to trigger KB ingestion for ${kbId}:`, error);
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { status: "FAILED" }
    });
  }
}
