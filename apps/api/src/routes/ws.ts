import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import Redis from "ioredis";

/**
 * WebSocket routes for real-time messaging.
 *
 * Events sent to clients:
 *   - message:new       — New inbound/outbound message
 *   - message:status    — Delivery status change (sent/delivered/read)
 *   - conversation:new  — New conversation started
 *   - conversation:update — Agent assigned, status changed
 *   - typing:start/stop — Typing indicators
 *   - broadcast:progress — Broadcast delivery updates
 *   - notification      — General notifications
 */

// In-memory connection store (per workspace)
const connections = new Map<string, Map<string, WebSocket>>();

export function broadcastToWorkspace(workspaceId: string, event: any) {
  const wsConns = connections.get(workspaceId);
  if (!wsConns) return;

  const payload = JSON.stringify(event);
  for (const [, ws] of wsConns) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

// Redis subscriber for cross-process WebSocket broadcasting
const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
subscriber.subscribe("ws:broadcast", (err) => {
  if (err) {
    console.error("[WS] Failed to subscribe to Redis:", err);
  } else {
    console.log("[WS] Subscribed to Redis channel: ws:broadcast");
  }
});

subscriber.on("message", (channel, message) => {
  if (channel === "ws:broadcast") {
    try {
      const data = JSON.parse(message);
      if (data.workspaceId) {
        broadcastToWorkspace(data.workspaceId, data);
      }
    } catch (e) {
      console.error("[WS] Failed to parse Redis message", e);
    }
  }
});

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, request) => {
    const token = (request.query as any).token;

    let userId: string;
    let workspaceId: string;

    // Verify JWT from query param
    try {
      const decoded = app.jwt.verify(token) as { userId: string };
      userId = decoded.userId;
    } catch {
      socket.send(JSON.stringify({ type: "error", payload: { message: "Invalid token" } }));
      socket.close(4001, "Unauthorized");
      return;
    }

    // Resolve the user's workspace so this connection receives events that
    // `broadcastToWorkspace` emits keyed by the real workspaceId (e.g. inbound
    // messages from the webhook handler). An optional `workspaceId` query param
    // lets multi-workspace users target a specific tenant; otherwise we fall
    // back to their first membership.
    const requestedWorkspaceId = (request.query as any).workspaceId as string | undefined;
    const membership = await prisma.workspaceMember.findFirst({
      where: requestedWorkspaceId
        ? { userId, workspaceId: requestedWorkspaceId }
        : { userId },
      select: { workspaceId: true },
    });

    if (!membership) {
      socket.send(JSON.stringify({ type: "error", payload: { message: "No workspace access" } }));
      socket.close(4003, "Forbidden");
      return;
    }

    workspaceId = membership.workspaceId;

    // Register connection
    if (!connections.has(workspaceId)) {
      connections.set(workspaceId, new Map());
    }
    connections.get(workspaceId)!.set(userId, socket as unknown as WebSocket);

    app.log.info(`[WS] User ${userId} connected to workspace ${workspaceId}`);

    // Send welcome event
    socket.send(JSON.stringify({
      type: "connected",
      payload: { userId, workspaceId },
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    socket.on("message", (raw: Buffer | string) => {
      try {
        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case "ping":
            socket.send(JSON.stringify({ type: "pong", payload: {}, timestamp: new Date().toISOString() }));
            break;

          case "typing:start":
          case "typing:stop":
            // Broadcast typing indicator to all agents in workspace
            broadcastToWorkspace(workspaceId, {
              type: data.type,
              payload: { userId, conversationId: data.payload?.conversationId },
              timestamp: new Date().toISOString(),
            });
            break;

          case "message:read":
            // Mark messages as read — could update DB here
            break;

          default:
            app.log.warn(`[WS] Unknown event type: ${data.type}`);
        }
      } catch (err) {
        app.log.warn("[WS] Failed to parse message");
      }
    });

    // Handle disconnect
    socket.on("close", () => {
      connections.get(workspaceId)?.delete(userId);
      if (connections.get(workspaceId)?.size === 0) {
        connections.delete(workspaceId);
      }
      app.log.info(`[WS] User ${userId} disconnected`);
    });

    socket.on("error", (err: any) => {
      app.log.error(`[WS] Socket error for user ${userId}:`, err);
    });
  });
}

export { connections };
