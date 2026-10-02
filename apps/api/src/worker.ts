/**
 * TickerPro background worker.
 *
 * Consumes the durable Redis queues for broadcast fan-out and recurring drip
 * campaign processing — work that must survive API restarts and scale
 * independently of the request path. Run as a separate process:
 *
 *   npm run worker          (dev)
 *   node dist/worker.js     (prod)
 */

import dotenv from "dotenv";
dotenv.config();

import { registerHandler, startConsumer, enqueue, queuesEnabled, closeQueue } from "./lib/queue.js";
import { executeBroadcast, resolveABTests } from "./services/broadcast-engine.js";
import { processDripCampaigns, processBirthdayTriggers } from "./services/drip-engine.js";
import { startKafkaConsumer, stopKafkaConsumer } from "./services/kafka-consumer.js";
import { syncContactToHubspot, syncOrderToShopify } from "./services/integrations/index.js";
import { processSLABreaches } from "./services/sla-engine.js";
import { processAbandonedCarts } from "./services/cart-recovery-engine.js";
import { prisma } from "@tickerpro/database/client";

const DRIP_INTERVAL_MS = 5 * 60 * 1000;          // process due drip steps every 5 minutes
const SLA_INTERVAL_MS = 1 * 60 * 1000;            // process SLA breaches every minute
const CART_RECOVERY_INTERVAL_MS = 15 * 60 * 1000; // Check carts every 15 minutes
const AB_TEST_INTERVAL_MS = 5 * 60 * 1000;        // Check A/B tests every 5 minutes
const BIRTHDAY_INTERVAL_MS = 24 * 60 * 60 * 1000; // Birthday/anniversary triggers once per day

const consumerTimers: NodeJS.Timeout[] = [];

// Stop polling, disconnect Kafka/Redis/Prisma, then exit. Triggered on the
// SIGTERM an orchestrator sends during a rolling deploy.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, shutting down…`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  try {
    for (const timer of consumerTimers) clearInterval(timer);
    await stopKafkaConsumer();
    await closeQueue();
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    console.error("[worker] error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function main() {
  if (!queuesEnabled) {
    console.error("[worker] REDIS_URL is not set — the durable worker requires Redis. Exiting.");
    process.exit(1);
  }

  // Broadcast fan-out.
  registerHandler("broadcast", async (data) => {
    await executeBroadcast(data.broadcastId);
  });

  // Drip ticks self-reschedule, forming a recurring loop.
  registerHandler("drip", async () => {
    await processDripCampaigns();
    await enqueue("drip", {}, { delayMs: DRIP_INTERVAL_MS });
  });

  // SLA Escalations tick
  registerHandler("sla", async () => {
    await processSLABreaches();
    await enqueue("sla", {}, { delayMs: SLA_INTERVAL_MS });
  });

  // Cart Recovery tick
  registerHandler("cart_recovery", async () => {
    await processAbandonedCarts();
    await enqueue("cart_recovery", {}, { delayMs: CART_RECOVERY_INTERVAL_MS });
  });

  // A/B Testing tick
  registerHandler("ab_test_eval", async () => {
    await resolveABTests();
    await enqueue("ab_test_eval", {}, { delayMs: AB_TEST_INTERVAL_MS });
  });

  // Birthday & Anniversary drip triggers — runs once per day
  registerHandler("birthday_trigger", async () => {
    await processBirthdayTriggers();
    await enqueue("birthday_trigger", {}, { delayMs: BIRTHDAY_INTERVAL_MS });
  });

  consumerTimers.push(
    startConsumer("broadcast"),
    startConsumer("drip"),
    startConsumer("sla"),
    startConsumer("cart_recovery"),
    startConsumer("ab_test_eval"),
    startConsumer("birthday_trigger")
  );

  // Integration CRM sync.
  registerHandler("integration_sync", async (data) => {
    const { provider, workspaceId, payload } = data;
    if (provider === "hubspot") {
      await syncContactToHubspot(workspaceId, payload);
    } else if (provider === "shopify") {
      await syncOrderToShopify(workspaceId, payload);
    }
  });
  consumerTimers.push(startConsumer("integration_sync"));

  // Start Kafka consumer for Meta Webhooks
  await startKafkaConsumer();

  // Seed recurring queues.
  await enqueue("drip", {}, { delayMs: DRIP_INTERVAL_MS });
  await enqueue("sla", {}, { delayMs: SLA_INTERVAL_MS });
  await enqueue("cart_recovery", {}, { delayMs: CART_RECOVERY_INTERVAL_MS });
  await enqueue("ab_test_eval", {}, { delayMs: AB_TEST_INTERVAL_MS });
  // Birthday triggers fire immediately on first start, then every 24h.
  await enqueue("birthday_trigger", {}, { delayMs: 0 });

  console.log("[worker] 🛠️  TickerPro worker running (broadcast + drip + sla + carts + ab eval + birthday/anniversary queues + kafka)");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
