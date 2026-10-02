/**
 * Lightweight observability layer with no hard dependency on a vendor SDK.
 *
 * By default errors are only logged (the caller already has pino). If SENTRY_DSN
 * is set AND `@sentry/node` is installed, we dynamically load and use it — so
 * adding real error tracking later is just `npm i @sentry/node` + the env var,
 * with no code changes here.
 */
type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;

export async function initObservability(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Optional dependency. The specifier is held in a variable so TypeScript does
    // not try to resolve @sentry/node at compile time — it may not be installed.
    const specifier: string = "@sentry/node";
    const mod = (await import(specifier).catch(() => null)) as SentryLike | null;
    if (mod && typeof mod.init === "function") {
      mod.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      });
      sentry = mod;
      console.log("[Observability] Sentry initialized");
    } else {
      console.warn("[Observability] SENTRY_DSN set but @sentry/node not installed — skipping");
    }
  } catch (err) {
    console.warn("[Observability] Failed to initialize Sentry:", err);
  }
}

/** Report an exception to the configured tracker (no-op if none). */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    try {
      sentry.captureException(err, context);
    } catch {
      /* never let reporting throw */
    }
  }
}
