import { createClient } from "@clickhouse/client";

const clickhouseUrl = process.env.CLICKHOUSE_URL || "http://localhost:8123";

// Determine if we should attempt connection based on environment
// We'll skip actual connection during tests or if missing Docker env overrides.
export const clickhouse = createClient({
  url: clickhouseUrl,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DB || "default",
  // Configure retries/timeouts for resilience
  request_timeout: 10000,
});

/**
 * Initialize ClickHouse tables if they don't exist.
 */
export async function initClickHouse() {
  try {
    console.log(`[ClickHouse] Connecting to ${clickhouseUrl}...`);
    // Check connection
    await clickhouse.ping();
    
    // Create messages_analytics table
    await clickhouse.exec({
      query: `
        CREATE TABLE IF NOT EXISTS messages_analytics (
          id String,
          workspaceId String,
          conversationId String,
          direction String,
          status String,
          sentiment String,
          sentimentScore Float32,
          createdAt DateTime
        ) ENGINE = MergeTree()
        ORDER BY (workspaceId, createdAt)
      `,
    });

    // Create ad_attribution table
    await clickhouse.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ad_attribution (
          id UUID,
          workspaceId String,
          adId String,
          contactId String,
          amount Float32,
          createdAt DateTime
        ) ENGINE = MergeTree()
        ORDER BY (workspaceId, adId, createdAt)
      `,
    });

    console.log("[ClickHouse] ✅ Connected and initialized tables.");
  } catch (err) {
    console.warn("[ClickHouse] ⚠️ Connection failed (Expected if Docker is not running):", err);
  }
}

/**
 * Log a message to ClickHouse for analytics.
 */
export async function trackMessageAnalytics(msg: any, sentiment: string = "NEUTRAL", score: number = 0) {
  try {
    await clickhouse.insert({
      table: "messages_analytics",
      values: [
        {
          id: msg.id,
          workspaceId: msg.workspaceId || "unknown", // Normally fetched from conversation
          conversationId: msg.conversationId,
          direction: msg.direction,
          status: msg.status,
          sentiment: sentiment,
          sentimentScore: score,
          createdAt: new Date(msg.createdAt).toISOString().replace("T", " ").substring(0, 19),
        },
      ],
      format: "JSONEachRow",
    });
  } catch (err) {
    console.error("[ClickHouse] Failed to track message analytics", err);
  }
}

/**
 * Log ad-driven revenue to ClickHouse for ROAS reporting.
 */
export async function trackAdAttribution(workspaceId: string, adId: string, contactId: string, amount: number) {
  try {
    const { v4: uuidv4 } = await import("uuid");
    await clickhouse.insert({
      table: "ad_attribution",
      values: [
        {
          id: uuidv4(),
          workspaceId,
          adId,
          contactId,
          amount,
          createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        },
      ],
      format: "JSONEachRow",
    });
  } catch (err) {
    console.error("[ClickHouse] Failed to track ad attribution", err);
  }
}

/**
 * Get ROAS (Return on Ad Spend) Analytics
 */
export async function getAdROAS(workspaceId: string) {
  try {
    const result = await clickhouse.query({
      query: `
        SELECT adId, sum(amount) as totalRevenue, count(*) as conversions
        FROM ad_attribution
        WHERE workspaceId = '${workspaceId}'
        GROUP BY adId
      `,
      format: "JSONEachRow",
    });
    return await result.json();
  } catch (err) {
    console.error("[ClickHouse] Failed to get Ad ROAS", err);
    return [];
  }
}
