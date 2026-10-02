import { vi } from "vitest";

// 1. Mock Prisma Client
vi.mock("@tickerpro/database/client", () => {
  return {
    prisma: {
      workspace: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      message: {
        create: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
      contact: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      whatsAppNumber: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      channelAccount: {
        findUnique: vi.fn(),
      },
      conversation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      outboundWebhook: {
        findMany: vi.fn(),
      },
      // add more models as needed
    },
  };
});

// 2. Mock Redis
vi.mock("ioredis", () => {
  const RedisMock = vi.fn(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
    on: vi.fn(),
  }));
  return { default: RedisMock };
});

// 3. Mock KafkaJS
vi.mock("kafkajs", () => {
  const mockProducer = {
    connect: vi.fn(),
    send: vi.fn(),
    disconnect: vi.fn(),
  };
  const mockConsumer = {
    connect: vi.fn(),
    subscribe: vi.fn(),
    run: vi.fn(),
    disconnect: vi.fn(),
  };
  const KafkaMock = vi.fn(() => ({
    producer: vi.fn(() => mockProducer),
    consumer: vi.fn(() => mockConsumer),
  }));
  return { Kafka: KafkaMock };
});

// 4. Mock Clickhouse
vi.mock("../../src/services/clickhouse.js", () => {
  return {
    initClickHouse: vi.fn(),
    trackMessageAnalytics: vi.fn(),
  };
});
