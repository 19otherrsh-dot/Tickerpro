import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@tickerpro/database/client";
import { startKafkaConsumer } from "../kafka-consumer.js";

// We'll test the internals via the mock we injected, 
// but since the file is structured with an internal processMessage,
// we can extract it for testability or test via the consumer callback if exposed.
// For now, let's just assert that startKafkaConsumer connects and subscribes.

vi.mock("kafkajs", () => {
  const mockRun = vi.fn();
  const mockSubscribe = vi.fn();
  const mockConnect = vi.fn();
  
  const mockConsumer = {
    connect: mockConnect,
    subscribe: mockSubscribe,
    run: mockRun,
  };
  
  return {
    Kafka: vi.fn(() => ({
      consumer: () => mockConsumer,
    }))
  };
});

import { Kafka } from "kafkajs";

describe("Kafka Consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should connect and subscribe to inbound-messages topic", async () => {
    await startKafkaConsumer();
    
    const kafkaInst = new Kafka({ clientId: "test", brokers: [] });
    const consumer = kafkaInst.consumer({ groupId: "test" });

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({ topic: "inbound-messages", fromBeginning: false });
    expect(consumer.run).toHaveBeenCalled();
  });
});
