import { FastifyInstance } from "fastify";
import { summarizeConversation, suggestReplies, scoreCxQuality } from "../services/copilot.js";

export async function copilotRoutes(app: FastifyInstance) {
  app.post(
    "/summarize",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { conversationId } = request.body as { conversationId: string };
      if (!conversationId) return reply.status(400).send({ error: "Missing conversationId" });

      try {
        const summary = await summarizeConversation(conversationId);
        return { success: true, summary };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post(
    "/suggest-replies",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { conversationId } = request.body as { conversationId: string };
      if (!conversationId) return reply.status(400).send({ error: "Missing conversationId" });

      try {
        const replies = await suggestReplies(conversationId);
        return { success: true, replies };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  /**
   * POST /copilot/score
   * On-demand CX quality scoring for a conversation (Wati AI CX Score parity).
   * Auto-triggers on conversation close too, but managers can call this manually.
   */
  app.post(
    "/score",
    { onRequest: [(app as any).requireRole(["MANAGER","ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { conversationId } = request.body as { conversationId: string };
      if (!conversationId) return reply.status(400).send({ error: "Missing conversationId" });

      try {
        const { score, reason } = await scoreCxQuality(conversationId);
        return { success: true, score, reason };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );
}
