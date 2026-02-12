import { describe, expect, it } from "vitest";
import { hasCollectionKey } from "./collection-key";

describe("hasCollectionKey", () => {
  const collections = {
    realms: { address: "0x1" },
    cosmetics: { address: "0x2" },
  } as const;

  it("returns true for known collection keys", () => {
    expect(hasCollectionKey(collections, "realms")).toBe(true);
  });

  it("returns false for unknown collection keys", () => {
    expect(hasCollectionKey(collections, "$collection")).toBe(false);
  });
});
