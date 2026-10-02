import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { contactRoutes } from "../contacts.js";
import { prisma } from "@tickerpro/database/client";

vi.mock("@tickerpro/database/client", () => ({
  prisma: {
    contact: {
      upsert: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe("Contacts CSV Import/Export", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(multipart);

    // Mock role verification
    app.decorate("requireRole", function () {
      return async () => { return; }; 
    });
    
    // Fallback for endpoints that still use authenticate (if any)
    app.decorate("authenticate", async () => { return; });

    await app.register(contactRoutes, { prefix: "/api/contacts" });
  });

  it("should process a CSV import stream", async () => {
    // We mock a multipart payload by creating a string that looks like a multipart form body
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    
    const csvContent = `phone,name,email,language,leadStage,company,role\n1234567890,John Doe,john@test.com,en,NEW,Acme Corp,CEO\n0987654321,Jane Smith,jane@test.com,es,QUALIFIED,,CTO`;

    const body = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="workspaceId"\r\n\r\n` +
      `ws_1\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="contacts.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--`;

    const response = await app.inject({
      method: "POST",
      url: "/api/contacts/import",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);

    // Verify first row mapped correctly including custom fields
    expect(prisma.contact.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { phoneNumber_workspaceId: { phoneNumber: "1234567890", workspaceId: "ws_1" } },
      create: expect.objectContaining({
        phoneNumber: "1234567890",
        name: "John Doe",
        customFields: { company: "Acme Corp", role: "CEO" }
      })
    }));

    // Verify second row mapped correctly
    expect(prisma.contact.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { phoneNumber_workspaceId: { phoneNumber: "0987654321", workspaceId: "ws_1" } },
      create: expect.objectContaining({
        customFields: { company: "", role: "CTO" }
      })
    }));
  });

  it("should export contacts as CSV", async () => {
    const mockContacts = [
      {
        id: "c_1",
        phoneNumber: "1112223333",
        name: "Alice",
        email: "alice@test.com",
        leadStage: "NEW",
        language: "en",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        customFields: { favoriteColor: "blue", loyaltyPoints: "100" }
      },
      {
        id: "c_2",
        phoneNumber: "4445556666",
        name: "Bob",
        email: "bob@test.com",
        leadStage: "QUALIFIED",
        language: "fr",
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        customFields: { favoriteColor: "red" } // missing loyaltyPoints
      }
    ];

    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts as any);

    const response = await app.inject({
      method: "GET",
      url: "/api/contacts/export?workspaceId=ws_1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv");
    
    // csv-stringify will automatically pad missing columns or handle dynamic keys 
    // across the rows if we pass the array of objects (it extracts all keys)
    const csvLines = response.body.trim().split("\n");
    expect(csvLines.length).toBe(3); // Header + 2 rows
    
    // Header should contain standard fields + all unique custom fields
    expect(csvLines[0]).toContain("favoriteColor");
    expect(csvLines[0]).toContain("loyaltyPoints");
    
    // First row checks
    expect(csvLines[1]).toContain("Alice");
    expect(csvLines[1]).toContain("blue");
    expect(csvLines[1]).toContain("100");
  });
});
