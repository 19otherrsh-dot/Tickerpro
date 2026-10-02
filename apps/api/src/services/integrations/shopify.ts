import { attributeRevenueToConversation } from "../attribution.js";

export async function syncOrderToShopify(workspaceId: string, orderData: any) {
  console.log(`[Shopify Sync] Syncing order details for workspace ${workspaceId}...`);
  
  // Mock external API call
  await new Promise((resolve) => setTimeout(resolve, 600));
  
  // Trigger revenue attribution back to Click-to-WhatsApp ads
  if (orderData.customerPhone && orderData.totalAmount) {
    await attributeRevenueToConversation(workspaceId, orderData.customerPhone, orderData.totalAmount);
  }

  console.log(`[Shopify Sync] ✅ Successfully synced to Shopify store.`);
  return { success: true, externalOrderId: `shp_${Date.now()}` };
}
