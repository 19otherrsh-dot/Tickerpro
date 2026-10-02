import { prisma } from "@tickerpro/database/client";
import { IntegrationType } from "@prisma/client";
import Stripe from "stripe";
import Razorpay from "razorpay";

export interface PaymentDetails {
  currency: string;
  amount: number; // In smallest currency unit (e.g., cents for USD, paise for INR)
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  contactId?: string;
  referenceId: string;
}

export async function createPaymentLink(workspaceId: string, details: PaymentDetails) {
  // 1. Determine active payment gateway
  const gateways = await prisma.integration.findMany({
    where: {
      workspaceId,
      isActive: true,
      type: {
        in: [IntegrationType.STRIPE, IntegrationType.RAZORPAY],
      },
    },
  });

  if (gateways.length === 0) {
    throw new Error("No active payment gateways found for this workspace.");
  }

  // Prefer Stripe if both are active, else Razorpay
  const stripe = gateways.find((g) => g.type === IntegrationType.STRIPE);
  const razorpay = gateways.find((g) => g.type === IntegrationType.RAZORPAY);

  let linkData: { url: string; provider: string; sessionId: string };

  if (stripe) {
    linkData = await createStripePaymentLink(stripe.config as any, details);
  } else if (razorpay) {
    linkData = await createRazorpayPaymentLink(razorpay.config as any, details);
  } else {
    throw new Error("Failed to initialize payment gateway.");
  }

  // 2. Create PaymentLink record in DB
  const paymentLink = await prisma.paymentLink.create({
    data: {
      workspaceId,
      contactId: details.contactId,
      amount: details.amount,
      currency: details.currency,
      description: details.description,
      provider: linkData.provider,
      externalId: linkData.sessionId,
      url: linkData.url,
      status: "PENDING",
    },
  });

  return paymentLink;
}

async function createStripePaymentLink(config: any, details: PaymentDetails) {
  try {
    const stripeClient = new Stripe(config.secretKey, { apiVersion: "2024-06-20" as any });
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: details.currency,
            product_data: { name: details.description },
            unit_amount: details.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://tickerpro.app/payment-success?ref=${details.referenceId}`,
      cancel_url: `https://tickerpro.app/payment-cancel?ref=${details.referenceId}`,
      client_reference_id: details.referenceId,
      customer_email: details.contactEmail,
    });
    return { url: session.url!, provider: "STRIPE", sessionId: session.id };
  } catch (err: any) {
    console.error("[Payments] Stripe Error:", err);
    throw new Error(`Stripe error: ${err.message}`);
  }
}

async function createRazorpayPaymentLink(config: any, details: PaymentDetails) {
  try {
    const rzp = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    const paymentLink = await rzp.paymentLink.create({
      amount: details.amount,
      currency: details.currency,
      accept_partial: false,
      description: details.description,
      customer: {
        email: details.contactEmail || "",
        contact: details.contactPhone || "",
      },
      notify: { sms: false, email: false },
      reference_id: details.referenceId,
    });
    return { url: paymentLink.short_url, provider: "RAZORPAY", sessionId: paymentLink.id };
  } catch (err: any) {
    console.error("[Payments] Razorpay Error:", err);
    throw new Error(`Razorpay error: ${err.message || "Unknown error"}`);
  }
}
