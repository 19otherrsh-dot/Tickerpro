/**
 * Lightweight durable job queue backed by Redis (ioredis).
 *
 * Jobs live in a Redis sorted set keyed by their run-at timestamp, so both
 * immediate and scheduled/delayed work share one mechanism. A consumer polls
 * for due jobs and claims each one atomically with ZREM — whichever worker's
 * ZREM removes the member is the single owner that runs it (at-least-once).
 *
 * When REDIS_URL is not configured the queue degrades gracefully: enqueue()
 * runs the registered handler inline so features still work in local dev,
 * at the cost of durability and out-of-process scaling.
 *
 * This intentionally avoids a heavier dependency (e.g. BullMQ/Kafka); ioredis
 * is already a dependency and this covers the broadcast + drip workloads.
 */

import Redis from "ioredis";

export type JobHandler = (data: any) => Promise<void>;

const REDIS_URL = process.env.REDIS_URL;
export const queuesEnabled = Boolean(REDIS_URL);

let connection: Redis | null = null;
function getConnection(): Redis {
  if (!connection) {
    // maxRetriesPerRequest: null keeps long-lived consumers from throwing on
    // transient Redis hiccups.
    connection = new Redis(REDIS_URL as string, { maxRetriesPerRequest: null });
  }
  return connection;
}

const keyFor = (queue: string) => `tickerpro:queue:${queue}`;

/** Ping Redis for readiness checks. Returns false if unconfigured or unreachable. */
export async function pingRedis(): Promise<boolean> {
  if (!queuesEnabled) return false;
  try {
    const res = await getConnection().ping();
    return res === "PONG";
  } catch {
    return false;
  }
}

/** Close the Redis connection on shutdown. */
export async function closeQueue(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}

// Handlers are registered in whichever process will run the work: the worker
// (with Redis) or the API itself (inline fallback without Redis).
const handlers = new Map<string, JobHandler>();

export function registerHandler(queue: string, handler: JobHandler): void {
  handlers.set(queue, handler);
}

interface QueuedJob {
  id: string;
  data: any;
  attempts: number;
}

function parseJob(member: string): QueuedJob | null {
  try {
    return JSON.parse(member) as QueuedJob;
  } catch {
    return null;
  }
}

/**
 * Enqueue a job to run now (default) or after `delayMs`.
 */
export async function enqueue(
  queue: string,
  data: any,
  opts: { delayMs?: number } = {}
): Promise<void> {
  if (!queuesEnabled) {
    const handler = handlers.get(queue);
    if (handler) {
      // Fire-and-forget inline so the request isn't blocked. Not durable.
      handler(data).catch((err) => console.error(`[queue:${queue}] inline job failed:`, err));
    } else {
      console.warn(`[queue:${queue}] no Redis and no inline handler — job dropped`);
    }
    return;
  }

  const runAt = Date.now() + (opts.delayMs ?? 0);
  const member = JSON.stringify({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    data,
    attempts: 0,
  });
  await getConnection().zadd(keyFor(queue), runAt, member);
}

/**
 * Start polling for due jobs on a queue. Call once per queue in the worker.
 * Returns the interval handle so callers can stop it on shutdown.
 */
export function startConsumer(queue: string, pollMs = 2000): NodeJS.Timeout {
  const conn = getConnection();
  const key = keyFor(queue);

  const tick = async () => {
    try {
      const now = Date.now();
      // Fetch a batch of jobs whose run time has passed.
      const due: string[] = await (conn.zrangebyscore as any)(key, "-inf", now, "LIMIT", 0, 20);

      for (const member of due) {
        // Atomic claim: exactly one worker's ZREM returns 1.
        const claimed = await conn.zrem(key, member);
        if (claimed !== 1) continue;

        const job = parseJob(member);
        if (!job) {
          console.error(`[queue:${queue}] dropping unparseable job`);
          continue;
        }

        const handler = handlers.get(queue);
        if (!handler) {
          console.warn(`[queue:${queue}] no handler registered — re-queuing`);
          await conn.zadd(key, now + 5000, member);
          continue;
        }

        try {
          await handler(job.data);
        } catch (err) {
          console.error(`[queue:${queue}] job ${job.id} failed (attempt ${job.attempts + 1}):`, err);
          if (job.attempts < 3) {
            const retry = JSON.stringify({ ...job, attempts: job.attempts + 1 });
            await conn.zadd(key, now + 30000, retry); // backoff 30s
          }
        }
      }
    } catch (err) {
      console.error(`[queue:${queue}] poll error:`, err);
    }
  };

  return setInterval(tick, pollMs);
}
