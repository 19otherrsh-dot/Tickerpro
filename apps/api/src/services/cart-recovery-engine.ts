import { prisma } from "@tickerpro/database/client";

export async function processAbandonedCarts() {
  console.log(`[Cart Recovery Engine] Scanning for abandoned carts...`);
  
  // Find carts older than 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const abandonedCarts = await prisma.ecomCart.findMany({
    where: {
      recovered: false,
      updatedAt: { lt: twoHoursAgo },
      contactId: { not: null }
    },
    include: { contact: true }
  });

  for (const cart of abandonedCarts) {
    if (!cart.contactId) continue;

    // Find the abandoned cart drip campaign for this workspace
    const campaign = await prisma.dripCampaign.findFirst({
      where: {
        workspaceId: cart.workspaceId,
        status: "ACTIVE",
        triggerType: "ABANDONED_CART"
      }
    });

    if (campaign) {
      // Enroll the contact in the recovery campaign
      const existingEnrollment = await prisma.dripEnrollment.findUnique({
        where: {
          campaignId_contactId: {
            campaignId: campaign.id,
            contactId: cart.contactId
          }
        }
      });

      if (!existingEnrollment) {
        await prisma.dripEnrollment.create({
          data: {
            campaignId: campaign.id,
            contactId: cart.contactId,
            currentStep: 0,
            nextRunAt: new Date(),
            status: "ACTIVE"
          }
        });
        console.log(`[Cart Recovery] Enrolled contact ${cart.contactId} into campaign ${campaign.id}`);
      }
    }
  }

  console.log(`[Cart Recovery Engine] Processed ${abandonedCarts.length} abandoned carts.`);
}
