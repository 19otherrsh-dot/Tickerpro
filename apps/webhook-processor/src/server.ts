import Fastify from "fastify";
import dotenv from "dotenv";
import { Kafka } from "kafkajs";
import crypto from "crypto";

dotenv.config();

const server = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

// Configure Kafka
const kafka = new Kafka({
  clientId: "webhook-processor",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const producer = kafka.producer();

// Connect to Kafka on startup
server.addHook("onReady", async () => {
  try {
    await producer.connect();
    server.log.info("🚀 Webhook Processor connected to Kafka");
  } catch (err) {
    server.log.error(err, "❌ Failed to connect to Kafka");
    process.exit(1);
  }
});

// Disconnect on shutdown
server.addHook("onClose", async () => {
  await producer.disconnect();
});

// Meta Webhook Verification (GET)
server.get("/webhook", async (request, reply) => {
  const query = request.query as any;
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  const verifyToken = process.env.META_VERIFY_TOKEN || "tickerpro_verify_token";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      server.log.info("✅ Webhook Verified");
      return reply.code(200).send(challenge);
    } else {
      return reply.code(403).send();
    }
  }
  return reply.code(400).send();
});

// Webhook Ingestion (POST)
server.post("/webhook", async (request, reply) => {
  const signature = request.headers["x-hub-signature-256"] as string;
  const body = request.body as any;

  // Basic signature validation
  if (process.env.META_APP_SECRET && signature) {
    const rawBody = JSON.stringify(body);
    const expectedSignature =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.META_APP_SECRET)
        .update(rawBody)
        .digest("hex");

    if (signature !== expectedSignature) {
      server.log.warn("❌ Invalid webhook signature");
      return reply.code(401).send({ error: "Invalid signature" });
    }
  }

  // Omnichannel Identification
  let channel = "WHATSAPP";
  if (body.object === "instagram") {
    channel = "INSTAGRAM";
  } else if (body.object === "page") {
    channel = "MESSENGER";
  }

  // Push to Kafka
  try {
    await producer.send({
      topic: "inbound-messages",
      messages: [
        {
          key: body.entry?.[0]?.id || "unknown_waba",
          value: JSON.stringify({ ...body, __tickerpro_channel: channel }),
        },
      ],
    });
    server.log.info("📩 Webhook queued to Kafka");
    return reply.code(200).send({ status: "ok" });
  } catch (err) {
    server.log.error(err, "❌ Failed to queue webhook to Kafka");
    return reply.code(500).send({ error: "Internal Server Error" });
  }
});

// Start Server
const port = Number(process.env.PORT) || 4001;
const host = process.env.HOST || "0.0.0.0";

try {
  await server.listen({ port, host });
  server.log.info(`🚀 Webhook Processor running on http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
