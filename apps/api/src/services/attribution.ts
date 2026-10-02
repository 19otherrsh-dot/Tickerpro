import { prisma } from "@tickerpro/database/client";
import { trackAdAttribution } from "./clickhouse.js";

/**
 * Revenue Attribution Engine
 * Tracks inbound conversations linked to an Ad ID, and attributes revenue
 * back to that Ad when a conversion event (like a Shopify purchase) happens.
 */

export async function attributeRevenueToConversation(workspaceId: string, contactPhoneNumber: string, amount: number) {
  console.log(`[Attribution] Attempting to attribute revenue for contact ${contactPhoneNumber}`);
  
  // Find the contact
  const contact = await prisma.contact.findFirst({
    where: { workspaceId, phoneNumber: contactPhoneNumber }
  });

  if (!contact) {
    console.log(`[Attribution] Contact not found, skipping attribution.`);
    return;
  }

  // Find the most recent conversation that originated from an ad
  const conversation = await prisma.conversation.findFirst({
    where: { 
      workspaceId, 
      contactId: contact.id,
      adId: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (conversation && conversation.adId) {
    console.log(`[Attribution] 🎯 Revenue of $${amount} attributed to Ad ID: ${conversation.adId} (Campaign: ${conversation.adTitle})`);
    
    // Stream to ClickHouse
    await trackAdAttribution(workspaceId, conversation.adId, contact.id, amount);
  } else {
    console.log(`[Attribution] No ad-sourced conversation found for contact ${contactPhoneNumber}. Organic conversion.`);
  }
}
