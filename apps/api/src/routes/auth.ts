import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@tickerpro/database/client";
import { sendPasswordResetEmail } from "../services/email/index.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  workspaceName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // ─── Register ──────────────────────────────────────────────────────
  app.post("/register", {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' }
    }
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return reply.status(409).send({ error: "User already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create user + workspace in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
        },
      });

      const slug = body.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const workspace = await tx.workspace.create({
        data: {
          name: body.workspaceName,
          slug: `${slug}-${user.id.slice(-6)}`,
        },
      });

      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "SUPER_ADMIN",
        },
      });

      return { user, workspace };
    });

    // Generate JWT
    const token = app.jwt.sign(
      {
        userId: result.user.id,
        email: result.user.email,
      },
      { expiresIn: "7d" }
    );

    reply.setCookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.status(201).send({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
      },
      token,
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────
  app.post("/login", {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' }
    }
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      { expiresIn: "7d" }
    );

    reply.setCookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
      token,
    };
  });

  // ─── Me ────────────────────────────────────────────────────────────
  app.get(
    "/me",
    { onRequest: [(app as any).authenticate] },
    async (request, _reply) => {
      const { userId } = request.user as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            include: { workspace: true },
          },
        },
      });

      if (!user) {
        return { error: "User not found" };
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        workspaces: user.memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
      };
    }
  );

  // ─── Forgot Password ────────────────────────────────────────────────
  app.post("/forgot-password", {
    config: {
      rateLimit: { max: 3, timeWindow: '1 minute' }
    }
  }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return reply.send({ message: "If that email exists, a reset link has been sent." });
    }

    // Generate a random token; persist only its SHA-256 hash so a DB leak can't
    // be replayed to reset accounts. The raw token goes to the user by email.
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Invalidate any outstanding resets for this user, then issue a fresh one.
    await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Deliver the reset link by email (console driver in dev). Never block the
    // response on the provider, and never reveal send failures to the caller.
    sendPasswordResetEmail(user.email, resetToken).catch((err) =>
      app.log.error(err, "[Auth] Failed to send password reset email")
    );

    // In production the token is delivered by email and MUST NEVER be returned
    // in the HTTP response — doing so would let anyone reset any account by
    // reading the response. Only expose it outside production for local testing.
    return reply.send({
      message: "If that email exists, a reset link has been sent.",
      ...(process.env.NODE_ENV !== "production" ? { _devToken: resetToken } : {}),
    });
  });

  // ─── Reset Password ─────────────────────────────────────────────────
  app.post("/reset-password", {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' }
    }
  }, async (request, reply) => {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).parse(request.body);

    // Look the token up by its hash (we never store the raw token).
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Invalid or expired reset token" });
    }

    // Update password and consume the token atomically (single-use).
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return reply.send({ message: "Password has been reset successfully" });
  });

  // ─── Update Profile ─────────────────────────────────────────────────
  app.patch(
    "/profile",
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const body = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
      }).parse(request.body);

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.firstName && { firstName: body.firstName }),
          ...(body.lastName && { lastName: body.lastName }),
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }
  );

  // ─── Change Password ────────────────────────────────────────────────
  app.post(
    "/change-password",
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }).parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return { message: "Password changed successfully" };
    }
  );
}
