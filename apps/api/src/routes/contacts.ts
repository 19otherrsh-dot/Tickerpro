import type { FastifyInstance } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { maskContacts, applyMaskToContact } from "../lib/mask.js";

export async function contactRoutes(app: FastifyInstance) {
  // ── List contacts ─────────────────────────────────────────────────
  app.get(
    "/",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const { search, stage, page = "1", limit = "50" } = request.query as Record<string, string>;

      // Get user's workspace
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: { select: { maskPhoneNumbers: true } } },
      });
      if (!membership) return { contacts: [], total: 0 };

      const where: any = { workspaceId: membership.workspaceId };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }
      if (stage) where.leadStage = stage;

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
        }),
        prisma.contact.count({ where }),
      ]);

      // Apply phone-number masking for AGENT-role members (Feature 3)
      const maskEnabled = (membership as any).workspace?.maskPhoneNumbers ?? false;
      return { contacts: maskContacts(contacts, membership.role, maskEnabled), total };
    }
  );

  // ── Get single contact ────────────────────────────────────────────
  app.get(
    "/:id",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user as { userId: string };
      const contact = await prisma.contact.findUnique({ where: { id } });
      if (!contact) return { error: "Contact not found" };

      // Apply masking for AGENT role (Feature 3)
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId: contact.workspaceId },
        include: { workspace: { select: { maskPhoneNumbers: true } } },
      });
      const maskEnabled = (membership as any)?.workspace?.maskPhoneNumbers ?? false;
      return applyMaskToContact(contact, membership?.role ?? "AGENT", maskEnabled);
    }
  );

  // ── Create contact ────────────────────────────────────────────────
  app.post(
    "/",
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { workspaceId, phoneNumber, name, email, birthday, anniversary } = request.body as any;

      if (!workspaceId) return reply.status(400).send({ error: "Missing workspaceId" });

      const contact = await prisma.contact.create({
        data: {
          workspaceId,
          phoneNumber,
          name,
          email,
          // Feature 2: birthday/anniversary for drip campaign triggers (MM-DD format)
          birthday: birthday ?? null,
          anniversary: anniversary ?? null,
          leadStage: "NEW",
        },
      });

      return contact;
    }
  );

  // ── CSV Import contacts ───────────────────────────────────────────
  app.post(
    "/import",
    { onRequest: [(app as any).requireRole(["AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "Missing CSV file" });

      const workspaceId = (data.fields.workspaceId as any)?.value;
      if (!workspaceId) return reply.status(400).send({ error: "Missing workspaceId field" });

      const { parse } = await import("csv-parse");
      const parser = data.file.pipe(parse({ columns: true, skip_empty_lines: true }));

      let successCount = 0;
      let errorCount = 0;

      for await (const record of parser) {
        try {
          const { phone, name, email, language, leadStage, ...customFields } = record;
          
          if (!phone) {
            errorCount++;
            continue;
          }

          // Clean phone number
          const cleanedPhone = phone.replace(/[^0-9]/g, '');

          await prisma.contact.upsert({
            where: { phoneNumber_workspaceId: { phoneNumber: cleanedPhone, workspaceId } },
            create: {
              workspaceId,
              phoneNumber: cleanedPhone,
              name: name || null,
              email: email || null,
              language: language || "en",
              leadStage: (leadStage as any) || "NEW",
              customFields
            },
            update: {
              name: name || undefined,
              email: email || undefined,
              language: language || undefined,
              leadStage: leadStage ? (leadStage as any) : undefined,
              customFields
            }
          });
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }

      return { success: true, processed: successCount, failed: errorCount };
    }
  );

  // ── Export contacts (CSV) ─────────────────────────────────────────
  app.get(
    "/export",
    { onRequest: [(app as any).requireRole(["VIEWER", "AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { workspaceId, stage } = request.query as any;
      if (!workspaceId) return reply.status(400).send({ error: "Missing workspaceId" });

      const where: any = { workspaceId };
      if (stage) where.leadStage = stage;

      const contacts = await prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      const { stringify } = await import("csv-stringify/sync");
      
      const records = contacts.map(c => {
        const custom = (c.customFields as Record<string, any>) || {};
        return {
          id: c.id,
          phoneNumber: c.phoneNumber,
          name: c.name || "",
          email: c.email || "",
          leadStage: c.leadStage,
          language: c.language || "",
          createdAt: c.createdAt.toISOString(),
          ...custom
        };
      });

      const csvString = stringify(records, { header: true });

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="contacts-${workspaceId}.csv"`);
      return reply.send(csvString);
    }
  );

  // ── Update contact ────────────────────────────────────────────────
  app.patch(
    "/:id",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        email: string;
        leadStage: string;
        customFields: Record<string, any>;
        /// Feature 2: birthday and anniversary for drip trigger campaigns
        birthday: string | null;
        anniversary: string | null;
      }>;

      const contact = await prisma.contact.update({
        where: { id },
        data: body as any,
      });

      return contact;
    }
  );

  // ── Delete contact ────────────────────────────────────────────────
  app.delete(
    "/:id",
    { onRequest: [(app as any).authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      await prisma.contact.delete({ where: { id } });
      return { success: true };
    }
  );
}
