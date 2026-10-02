import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { prisma } from "@tickerpro/database/client";

// Mocks
vi.mock("@tickerpro/database/client", () => ({
  prisma: {
    workspaceMember: {
      findUnique: vi.fn(),
    },
  },
}));

describe("RBAC Enforcement Middleware", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();

    // Setup JWT (matching server.ts)
    await app.register(jwt, { secret: "test-secret" });

    // Setup requireRole Decorator (simulating server.ts logic)
    app.decorate("requireRole", function (allowedRoles: string[]) {
      return async (request: any, reply: any) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const workspaceId = request.query?.workspaceId || request.body?.workspaceId;
        if (!workspaceId) {
          return reply.status(400).send({ error: "Missing workspaceId for role verification" });
        }

        const member = await prisma.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId: request.user.id, workspaceId } }
        });

        if (!member || !allowedRoles.includes(member.role)) {
          return reply.status(403).send({ error: "Forbidden: Insufficient role permissions" });
        }
      };
    });

    // Mock Route
    app.get("/api/test-admin", { preValidation: [(app as any).requireRole(["ADMIN"])] }, async () => {
      return { success: true };
    });

    app.get("/api/test-agent", { preValidation: [(app as any).requireRole(["AGENT", "ADMIN"])] }, async () => {
      return { success: true };
    });
  });

  it("should block unauthenticated requests (401)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/test-admin?workspaceId=ws_1",
    });

    expect(response.statusCode).toBe(401);
  });

  it("should block if workspaceId is missing (400)", async () => {
    const token = app.jwt.sign({ id: "user_1" });
    const response = await app.inject({
      method: "GET",
      url: "/api/test-admin", // No workspaceId provided
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(400);
  });

  it("should block an AGENT from accessing ADMIN route (403)", async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue({
      id: "mem_1",
      userId: "user_1",
      workspaceId: "ws_1",
      role: "AGENT",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const token = app.jwt.sign({ id: "user_1" });
    const response = await app.inject({
      method: "GET",
      url: "/api/test-admin?workspaceId=ws_1",
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toMatch(/Forbidden/);
  });

  it("should allow an ADMIN to access ADMIN route (200)", async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue({
      id: "mem_1",
      userId: "user_1",
      workspaceId: "ws_1",
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const token = app.jwt.sign({ id: "user_1" });
    const response = await app.inject({
      method: "GET",
      url: "/api/test-admin?workspaceId=ws_1",
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
  });

  it("should allow an AGENT to access AGENT route (200)", async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue({
      id: "mem_1",
      userId: "user_1",
      workspaceId: "ws_1",
      role: "AGENT",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const token = app.jwt.sign({ id: "user_1" });
    const response = await app.inject({
      method: "GET",
      url: "/api/test-agent?workspaceId=ws_1",
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
  });
});
