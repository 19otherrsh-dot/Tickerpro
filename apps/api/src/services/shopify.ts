import { prisma } from "@tickerpro/database/client";
import { IntegrationType } from "@prisma/client";

/**
 * Handle incoming Shopify webhooks.
 * Shopify sends webhooks to a designated URL, e.g., /api/webhooks/shopify?workspaceId=xyz
 */
export async function handleShopifyWebhook(
  workspaceId: string,
  topic: string,
  payload: any
) {
  try {
    // 1. Verify integration is active
    const integration = await prisma.integration.findUnique({
      where: {
        workspaceId_type: {
          workspaceId,
          type: IntegrationType.SHOPIFY,
        },
      },
    });

    if (!integration || !integration.isActive) {
      console.warn(`Shopify integration is not active for workspace ${workspaceId}`);
      return;
    }

    // 2. Route by topic
    switch (topic) {
      case "checkouts/create":
      case "checkouts/update":
        await handleAbandonedCart(workspaceId, payload);
        break;

      case "orders/create":
        await handleOrderCreated(workspaceId, payload);
        break;

      case "orders/fulfilled":
        await handleOrderFulfilled(workspaceId, payload);
        break;

      default:
        console.log(`Unhandled Shopify webhook topic: ${topic}`);
    }
  } catch (error) {
    console.error(`Error handling Shopify webhook:`, error);
  }
}

async function handleAbandonedCart(workspaceId: string, checkout: any) {
  // Shopify checkout payload
  const { id, total_price, currency, abandoned_checkout_url, customer, line_items } = checkout;

  if (!customer || !customer.phone) {
    // Cannot send WhatsApp message without a phone number
    return;
  }

  // Format phone number (remove +, spaces, etc.)
  let phone = customer.phone.replace(/\D/g, "");

  // 1. Find or create contact
  let contact = await prisma.contact.findUnique({
    where: {
      phoneNumber_workspaceId: {
        phoneNumber: phone,
        workspaceId,
      },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phoneNumber: phone,
        name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null,
        email: customer.email || null,
        workspaceId,
      },
    });
  }

  // 2. Create or update EcomCart
  await prisma.ecomCart.upsert({
    where: {
      workspaceId_externalCartId: {
        workspaceId,
        externalCartId: String(id),
      },
    },
    update: {
      totalAmount: parseFloat(total_price),
      currency,
      checkoutUrl: abandoned_checkout_url,
      items: line_items.map((item: any) => ({ name: item.title, quantity: item.quantity, price: item.price })),
    },
    create: {
      workspaceId,
      externalCartId: String(id),
      totalAmount: parseFloat(total_price),
      currency,
      checkoutUrl: abandoned_checkout_url,
      items: line_items.map((item: any) => ({ name: item.title, quantity: item.quantity, price: item.price })),
      contactId: contact.id,
    },
  });

  // Automatically enroll in Abandoned Cart Drip Campaign if active
  const campaign = await prisma.dripCampaign.findFirst({
    where: { workspaceId, triggerType: "ABANDONED_CART", status: "ACTIVE" }
  });

  if (campaign) {
    const existingEnrollment = await prisma.dripEnrollment.findUnique({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } }
    });

    if (!existingEnrollment) {
      const steps = campaign.steps as any[];
      const firstStepDelayHours = steps && steps.length > 0 ? (steps[0].delayHours || 0) : 1;
      const nextRunAt = new Date(Date.now() + firstStepDelayHours * 60 * 60 * 1000);

      await prisma.dripEnrollment.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          nextRunAt,
          status: "ACTIVE",
          currentStep: 0
        }
      });
      console.log(`Enrolled contact ${contact.id} into Abandoned Cart campaign ${campaign.id}`);
    }
  } else {
    console.log(`Abandoned cart saved for ${phone}, but no active ABANDONED_CART campaign found.`);
  }
}

async function handleOrderCreated(workspaceId: string, order: any) {
  const { id, total_price, currency, customer, line_items, order_status_url } = order;

  // Find contact
  let phone = customer?.phone?.replace(/\D/g, "");
  
  let contactId = null;
  if (phone) {
    const contact = await prisma.contact.findUnique({
      where: { phoneNumber_workspaceId: { phoneNumber: phone, workspaceId } },
    });
    if (contact) contactId = contact.id;
  }

  // Save order
  await prisma.ecomOrder.upsert({
    where: {
      workspaceId_externalOrderId: { workspaceId, externalOrderId: String(id) },
    },
    update: {
      totalAmount: parseFloat(total_price),
      status: "CREATED",
      orderUrl: order_status_url,
    },
    create: {
      workspaceId,
      externalOrderId: String(id),
      totalAmount: parseFloat(total_price),
      currency,
      status: "CREATED",
      orderUrl: order_status_url,
      items: line_items.map((item: any) => ({ name: item.title, quantity: item.quantity, price: item.price })),
      contactId,
    },
  });

  console.log(`Order ${id} created for workspace ${workspaceId}`);
}

async function handleOrderFulfilled(workspaceId: string, order: any) {
  const { id } = order;
  await prisma.ecomOrder.update({
    where: {
      workspaceId_externalOrderId: { workspaceId, externalOrderId: String(id) },
    },
    data: { status: "FULFILLED" },
  });
  console.log(`Order ${id} fulfilled`);
}
