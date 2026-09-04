import { describe, expect, it, vi } from "vitest";

import { normalizeStructureEntityId } from "./structure-entity-id";

describe("normalizeStructureEntityId", () => {
  it("accepts numeric entity ids unchanged", () => {
    expect(normalizeStructureEntityId(7 as any)).toBe(7);
  });

  it("converts bigint and string ids to numbers", () => {
    expect(normalizeStructureEntityId(9n as any)).toBe(9);
    expect(normalizeStructureEntityId("11" as any)).toBe(11);
  });

  it("returns undefined for missing or invalid ids", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(normalizeStructureEntityId(undefined)).toBeUndefined();
    expect(normalizeStructureEntityId("not-a-number" as any)).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
