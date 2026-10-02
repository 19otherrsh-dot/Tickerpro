import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@tickerpro/database/client";
import { createPaymentLink } from "../services/payments.js";
import { sendMessage } from "../services/whatsapp.js";

interface PaymentRequest {
  contactId: string;
  amount: number;
  currency?: string;
  description: string;
}

export async function paymentRoutes(fastify: FastifyInstance) {
  // ─── Generate Payment Link ───────────────────────────────────────────────
  fastify.post("/links", { preValidation: [(fastify as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request: FastifyRequest<{ Body: PaymentRequest }>,
    reply
  ) => {
    const { workspaceId } = (request.user as any) || request.query;
    if (!workspaceId) return reply.status(401).send({ error: "Unauthorized" });

    const { contactId, amount, currency = "USD", description } = request.body;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    try {
      // Generate the link
      const linkData = await createPaymentLink(workspaceId, {
        contactId: contact.id,
        currency,
        amount,
        description,
        contactEmail: contact.email || undefined,
        contactPhone: contact.phoneNumber,
        referenceId: `inv_${Date.now()}_${contactId.substring(0, 5)}`,
      });

      // Send the payment link via WhatsApp automatically
      const waNumber = await prisma.whatsAppNumber.findFirst({
        where: { workspaceId, isActive: true },
      });

      if (waNumber) {
        // Send a message
        const waRes = await sendMessage(
          {
            accessToken: "mock_token", // In a real app, from waNumber config
            phoneNumberId: waNumber.phoneNumber,
            wabaId: "mock_waba_id",
            webhookVerifyToken: "",
          },
          contact.phoneNumber,
          {
            type: "text",
            text: {
              body: `Hello ${contact.name || "there"}! Here is your payment link for ${description}: ${linkData.url}`,
            },
          }
        );

        // Find conversation and save message
        const conversation = await prisma.conversation.findFirst({
          where: { contactId: contact.id, status: { not: "CLOSED" } },
        });

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "OUTBOUND",
              type: "TEXT",
              content: { text: `Payment link sent: ${linkData.url}` },
              status: "SENT",
              waMessageId: waRes.messages?.[0]?.id || `mock_${Date.now()}`,
            },
          });
        }
      }

      return { success: true, paymentLink: linkData };
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ─── Webhooks for Gateways (Public) ────────────────────────────────────
  fastify.post("/webhooks/stripe", async (request, reply) => {
    // In production: verify Stripe signature using rawBody and endpointSecret
    const event = request.body as any;
    console.log("[Stripe Webhook] Received event", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentLink = await prisma.paymentLink.findFirst({
        where: { externalId: session.id },
      });

      if (paymentLink) {
        await prisma.paymentLink.update({
          where: { id: paymentLink.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    }

    return { received: true };
  });

  fastify.post("/webhooks/razorpay", async (request, reply) => {
    // In production: verify Razorpay signature using x-razorpay-signature
    const event = request.body as any;
    console.log("[Razorpay Webhook] Received event", event.event);

    if (event.event === "payment_link.paid") {
      const paymentLinkPayload = event.payload.payment_link.entity;
      const paymentLink = await prisma.paymentLink.findFirst({
        where: { externalId: paymentLinkPayload.id },
      });

      if (paymentLink) {
        await prisma.paymentLink.update({
          where: { id: paymentLink.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    }
    return { received: true };
  });

  // ─── SaaS Subscription Billing ───────────────────────────────────────────
  fastify.post("/subscription/create-checkout-session", { preValidation: [(fastify as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request,
    reply
  ) => {
    const { workspaceId } = request.query as any;
    const { planId } = request.body as any; // e.g., 'price_growth_monthly'
    
    if (!workspaceId || !planId) return reply.status(400).send({ error: "Missing required fields" });

    // Mock Stripe checkout session creation
    return { 
      checkoutUrl: `https://mock-checkout.stripe.com/pay/${planId}?client_reference_id=${workspaceId}`,
      sessionId: `cs_test_${Date.now()}`
    };
  });

  fastify.post("/subscription/billing-portal", { preValidation: [(fastify as any).requireRole(["AGENT","MANAGER","ADMIN","SUPER_ADMIN"])] }, async (
    request,
    reply
  ) => {
    const { workspaceId } = request.query as any;
    if (!workspaceId) return reply.status(400).send({ error: "Missing required fields" });

    // Mock Stripe Customer Portal session creation
    return { 
      portalUrl: `https://billing.stripe.com/p/session/mock_${workspaceId}` 
    };
  });

  fastify.post("/webhooks/stripe/billing", async (request, reply) => {
    const event = request.body as any;
    console.log("[Stripe Billing Webhook] Received event", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const workspaceId = session.client_reference_id;
      
      // Update workspace subscription status in DB
      if (workspaceId) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            plan: "GROWTH", // Extracted from session
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            isActive: true,
          } as any
        });
      }
    }

    return { received: true };
  });
}
