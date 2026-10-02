// k6 load test for the Meta webhook ingestion path.
//
// The execution plan targets < 500ms p99 under high webhook volume. This script
// hammers POST /api/webhooks/meta and asserts the latency budget.
//
// Run (requires k6 — https://k6.io):
//   k6 run apps/api/load-tests/webhook-load.js
//   API_BASE=https://staging.tickerpro.com k6 run apps/api/load-tests/webhook-load.js
//
// Note: in production the endpoint verifies X-Hub-Signature-256; set
// META_APP_SECRET=<empty/unset> in a non-production env to load-test without signing,
// or extend this script to compute the HMAC.

/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.API_BASE || "http://localhost:4000";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // ramp up
    { duration: "1m", target: 200 }, // sustained load
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(99)<500"], // 500ms p99 budget
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

function payload() {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "TEST_PHONE_ID" },
              messages: [
                {
                  from: "15550001111",
                  id: `wamid.${Date.now()}.${Math.random()}`,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: "text",
                  text: { body: "load-test message" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

export default function () {
  const res = http.post(`${BASE}/api/webhooks/meta`, payload(), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "acked fast": (r) => r.timings.duration < 500,
  });
  sleep(0.1);
}
