import { prisma } from "@tickerpro/database/client";

export async function processAbandonedCart(workspaceId: string, payload: any) {
  console.log(`[Abandoned Cart] Processing abandoned cart for workspace ${workspaceId}`);

  const { id: cartId, email, phone, line_items, total_price, abandoned_checkout_url } = payload;
  if (!phone) {
    console.warn(`[Abandoned Cart] Checkout ${cartId} has no phone number. Skipping.`);
    return;
  }

  // Find or create contact
  let contact = await prisma.contact.findUnique({
    where: { phoneNumber_workspaceId: { phoneNumber: phone, workspaceId } }
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phoneNumber: phone,
        workspaceId,
        leadStage: "NEW"
      }
    });
  }

  // Record the cart in our database
  await prisma.ecomCart.upsert({
    where: { workspaceId_externalCartId: { workspaceId, externalCartId: String(cartId) } },
    create: {
      workspaceId,
      externalCartId: String(cartId),
      totalAmount: parseFloat(total_price),
      checkoutUrl: abandoned_checkout_url,
      items: line_items || [],
      contactId: contact.id
    },
    update: {
      totalAmount: parseFloat(total_price),
      checkoutUrl: abandoned_checkout_url,
      items: line_items || [],
      contactId: contact.id
    }
  });

  console.log(`[Abandoned Cart] Triggering recovery drip campaign for cart ${cartId} (Contact: ${phone})...`);

  // Find the active Abandoned Cart Drip Campaign for this workspace
  const campaign = await prisma.dripCampaign.findFirst({
    where: {
      workspaceId,
      triggerType: "ABANDONED_CART",
      status: "ACTIVE"
    }
  });

  if (campaign) {
    // Schedule the first message to run in 15 minutes
    const nextRunAt = new Date(Date.now() + 15 * 60 * 1000);

    // DripEnrollment has no workspaceId — it is scoped through its campaign.
    await prisma.dripEnrollment.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        status: "ACTIVE",
        currentStep: 0,
        nextRunAt
      }
    });
    console.log(`[Abandoned Cart] Enrolled contact in Drip Campaign ${campaign.id}`);
  } else {
    console.log(`[Abandoned Cart] No active ABANDONED_CART campaign found for workspace ${workspaceId}.`);
  }
  
  return { success: true, cartId };
}
