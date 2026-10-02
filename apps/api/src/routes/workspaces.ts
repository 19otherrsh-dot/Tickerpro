import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";

export async function workspaceRoutes(app: FastifyInstance) {
  // ── Get current workspace ─────────────────────────────────────────
  app.get(
    "/current",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true },
      });

      if (!membership) return { error: "No workspace found" };

      return {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        plan: membership.workspace.plan,
        role: membership.role,
      };
    }
  );

  // ── Update workspace ──────────────────────────────────────────────
  app.patch(
    "/current",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const body = request.body as { name?: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      });
      if (!membership) return { error: "Insufficient permissions" };

      const workspace = await prisma.workspace.update({
        where: { id: membership.workspaceId },
        data: { name: body.name },
      });

      return workspace;
    }
  );

  // ── List members ──────────────────────────────────────────────────
  app.get(
    "/members",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { userId } = request.user as { userId: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
      });
      if (!membership) return [];

      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: membership.workspaceId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      return members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role,
        status: "active",
        createdAt: m.createdAt,
      }));
    }
  );

  // ── Invite member ─────────────────────────────────────────────────
  app.post(
    "/members/invite",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { email, role } = request.body as { email: string; role: string };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      });
      if (!membership) return reply.status(403).send({ error: "Insufficient permissions" });

      // Check if user exists
      let invitedUser = await prisma.user.findUnique({ where: { email } });

      if (!invitedUser) {
        // Create a placeholder user (they'll set password on first login)
        invitedUser = await prisma.user.create({
          data: {
            email,
            passwordHash: "", // Empty until they register
            firstName: email.split("@")[0] || "User",
            lastName: "",
          },
        });
      }

      // Add to workspace
      try {
        await prisma.workspaceMember.create({
          data: {
            userId: invitedUser.id,
            workspaceId: membership.workspaceId,
            role: role as any,
          },
        });
      } catch {
        return reply.status(409).send({ error: "User already a member" });
      }

      // TODO: Send invite email via Resend/SES

      return reply.status(201).send({ success: true });
    }
  );

  // ── Update member role ────────────────────────────────────────────
  app.patch(
    "/members/:memberId",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { memberId } = request.params as { memberId: string };
      const { role } = request.body as { role: string };

      const member = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role: role as any },
      });

      return member;
    }
  );

  // ── Remove member ─────────────────────────────────────────────────
  app.delete(
    "/members/:memberId",
    { onRequest: [(app as any).requireRole(["ADMIN","SUPER_ADMIN"])] },
    async (request) => {
      const { memberId } = request.params as { memberId: string };
      await prisma.workspaceMember.delete({ where: { id: memberId } });
      return { success: true };
    }
  );
  // ── Get Widget Config ──────────────────────────────────────────────
  app.get(
    "/:workspaceId/widget-config",
    { onRequest: [(app as any).requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { widgetConfig: true }
      });
      return workspace?.widgetConfig || {};
    }
  );

  // ── Update Widget Config ───────────────────────────────────────────
  app.put(
    "/:workspaceId/widget-config",
    { onRequest: [(app as any).requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const config = request.body as any;
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { widgetConfig: config }
      });
      return { success: true };
    }
  );

  /**
   * PATCH /workspaces/settings
   * Update workspace-level SLA policy and agent privacy settings.
   *
   * Feature 1 — SLA policy: slaResponseMinutes (null = disabled)
   * Feature 3 — Phone masking: maskPhoneNumbers boolean
   */
  app.patch(
    "/settings",
    { onRequest: [(app as any).requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const body = request.body as {
        slaResponseMinutes?: number | null;
        maskPhoneNumbers?: boolean;
        autoAssign?: boolean;
        csatEnabled?: boolean;
        businessHours?: any;
        awayMessage?: string;
      };

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      });
      if (!membership) return reply.status(403).send({ error: "Insufficient permissions" });

      const data: any = {};
      if (body.slaResponseMinutes !== undefined) data.slaResponseMinutes = body.slaResponseMinutes;
      if (body.maskPhoneNumbers !== undefined)   data.maskPhoneNumbers = body.maskPhoneNumbers;
      if (body.autoAssign !== undefined)          data.autoAssign = body.autoAssign;
      if (body.csatEnabled !== undefined)         data.csatEnabled = body.csatEnabled;
      if (body.businessHours !== undefined)       data.businessHours = body.businessHours;
      if (body.awayMessage !== undefined)         data.awayMessage = body.awayMessage;

      const workspace = await prisma.workspace.update({
        where: { id: membership.workspaceId },
        data,
        select: {
          id: true,
          name: true,
          plan: true,
          autoAssign: true,
          csatEnabled: true,
          slaResponseMinutes: true,
          maskPhoneNumbers: true,
          businessHours: true,
          awayMessage: true,
        },
      });

      return { success: true, workspace };
    }
  );
}

