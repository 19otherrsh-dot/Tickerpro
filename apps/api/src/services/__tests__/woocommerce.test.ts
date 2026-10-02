import { describe, it, expect } from "vitest";
import { mapWooStatus } from "../woocommerce.js";

describe("mapWooStatus", () => {
  it("maps completed → FULFILLED", () => {
    expect(mapWooStatus("completed")).toBe("FULFILLED");
  });

  it("maps cancelled/refunded/failed → CANCELLED", () => {
    expect(mapWooStatus("cancelled")).toBe("CANCELLED");
    expect(mapWooStatus("refunded")).toBe("CANCELLED");
    expect(mapWooStatus("failed")).toBe("CANCELLED");
  });

  it("maps processing/on-hold → PAID", () => {
    expect(mapWooStatus("processing")).toBe("PAID");
    expect(mapWooStatus("on-hold")).toBe("PAID");
  });

  it("defaults unknown/pending → CREATED", () => {
    expect(mapWooStatus("pending")).toBe("CREATED");
    expect(mapWooStatus("something-else")).toBe("CREATED");
  });
});
