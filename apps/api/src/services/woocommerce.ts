import { prisma } from "@tickerpro/database/client";
import { IntegrationType } from "@prisma/client";

/**
 * Handle incoming WooCommerce webhooks.
 *
 * WooCommerce delivers the event name in the `x-wc-webhook-topic` header
 * (e.g. "order.created", "order.updated"). Payload shape differs from Shopify:
 * phone/email live under `billing`, totals are strings under `total`, and status
 * is one of pending|processing|on-hold|completed|cancelled|refunded|failed.
 */
export async function handleWooCommerceWebhook(
  workspaceId: string,
  topic: string,
  payload: any
) {
  try {
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId, type: IntegrationType.WOOCOMMERCE } },
    });

    if (!integration || !integration.isActive) {
      console.warn(`WooCommerce integration is not active for workspace ${workspaceId}`);
      return;
    }

    switch (topic) {
      case "order.created":
        await handleOrderCreated(workspaceId, payload);
        break;
      case "order.updated":
        await handleOrderUpdated(workspaceId, payload);
        break;
      // Feature 6: Abandoned cart recovery — DoubleTick parity.
      // WooCommerce sends these via its "abandoned cart" plugins (e.g. WooCommerce Abandoned Cart Lite).
      case "cart.created":
      case "cart.updated":
        await handleCartUpdated(workspaceId, payload);
        break;
      default:
        console.log(`Unhandled WooCommerce webhook topic: ${topic}`);
    }
  } catch (error) {
    console.error(`Error handling WooCommerce webhook:`, error);
  }
}


/** Map WooCommerce order status to our internal EcomOrder status. */
export function mapWooStatus(status: string): string {
  switch (status) {
    case "completed":
      return "FULFILLED";
    case "cancelled":
    case "refunded":
    case "failed":
      return "CANCELLED";
    case "processing":
    case "on-hold":
      return "PAID";
    default:
      return "CREATED";
  }
}

function itemsFrom(lineItems: any[]): Array<{ name: string; quantity: number; price: string }> {
  return (lineItems || []).map((item: any) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.total ?? item.price ?? "0",
  }));
}

async function resolveContactId(workspaceId: string, billing: any): Promise<string | null> {
  const phone = billing?.phone?.replace(/\D/g, "");
  if (!phone) return null;

  const contact = await prisma.contact.upsert({
    where: { phoneNumber_workspaceId: { phoneNumber: phone, workspaceId } },
    update: {},
    create: {
      phoneNumber: phone,
      name: `${billing.first_name || ""} ${billing.last_name || ""}`.trim() || null,
      email: billing.email || null,
      workspaceId,
    },
  });
  return contact.id;
}

async function handleOrderCreated(workspaceId: string, order: any) {
  const contactId = await resolveContactId(workspaceId, order.billing);

  await prisma.ecomOrder.upsert({
    where: { workspaceId_externalOrderId: { workspaceId, externalOrderId: String(order.id) } },
    update: {
      totalAmount: parseFloat(order.total || "0"),
      status: mapWooStatus(order.status),
    },
    create: {
      workspaceId,
      externalOrderId: String(order.id),
      totalAmount: parseFloat(order.total || "0"),
      currency: order.currency || "USD",
      status: mapWooStatus(order.status),
      items: itemsFrom(order.line_items),
      contactId,
    },
  });

  console.log(`[WooCommerce] Order ${order.id} created for workspace ${workspaceId}`);
}

async function handleOrderUpdated(workspaceId: string, order: any) {
  await prisma.ecomOrder.updateMany({
    where: { workspaceId, externalOrderId: String(order.id) },
    data: { status: mapWooStatus(order.status) },
  });
  console.log(`[WooCommerce] Order ${order.id} updated → ${mapWooStatus(order.status)}`);
}

/**
 * Feature 6 — Abandoned cart recovery (DoubleTick parity).
 *
 * WooCommerce cart webhooks (via plugins like "Abandoned Cart Lite") deliver a
 * cart payload. We upsert it into EcomCart so the shared cart-recovery-engine
 * can send WhatsApp reminders at the next poll cycle — exactly as it does for
 * Shopify carts.
 *
 * Expected payload shape (plugin-dependent, common fields used):
 *   { cart_contents: [...], cart_total: "123.00", currency: "USD",
 *     billing_email: "...", billing_phone: "...", billing_first_name: "..." }
 */
async function handleCartUpdated(workspaceId: string, cart: any) {
  const cartId = cart.id ?? cart.cart_id ?? String(Date.now());
  const totalAmount = parseFloat(cart.cart_total ?? cart.total ?? "0");
  const currency = cart.currency || "USD";
  const checkoutUrl = cart.checkout_url ?? null;

  // Build item list from cart_contents (array of product line items)
  const items = (cart.cart_contents ?? cart.line_items ?? []).map((item: any) => ({
    name: item.product_name ?? item.name,
    quantity: item.quantity ?? 1,
    price: item.line_total ?? item.price ?? "0",
  }));

  // Resolve or create contact from billing phone / email
  const phone = (cart.billing_phone ?? "")?.replace(/\D/g, "");
  let contactId: string | null = null;
  if (phone) {
    const contact = await prisma.contact.upsert({
      where: { phoneNumber_workspaceId: { phoneNumber: phone, workspaceId } },
      update: {},
      create: {
        phoneNumber: phone,
        name: `${cart.billing_first_name ?? ""} ${cart.billing_last_name ?? ""}`.trim() || null,
        email: cart.billing_email || null,
        workspaceId,
      },
    });
    contactId = contact.id;
  }

  await prisma.ecomCart.upsert({
    where: { workspaceId_externalCartId: { workspaceId, externalCartId: String(cartId) } },
    update: {
      totalAmount,
      items,
      checkoutUrl,
      recovered: false, // Reset recovery flag if cart is updated
    },
    create: {
      workspaceId,
      externalCartId: String(cartId),
      totalAmount,
      currency,
      checkoutUrl,
      items,
      recovered: false,
      contactId,
    },
  });

  console.log(`[WooCommerce] Cart ${cartId} upserted for workspace ${workspaceId} — ready for recovery engine`);
}

