import { describe, expect, it } from "vitest";

import { normalizeStructureEntityId } from "./structure-entity-id";

describe("normalizeStructureEntityId", () => {
  it("accepts numeric entity ids unchanged", () => {
    expect(normalizeStructureEntityId(7)).toBe(7);
  });

  it("converts bigint and string ids to numbers", () => {
    expect(normalizeStructureEntityId(9n)).toBe(9);
    expect(normalizeStructureEntityId("11")).toBe(11);
  });

  it("has no id for a missing one, and refuses a malformed one loudly instead of skipping it", () => {
    expect(normalizeStructureEntityId(undefined)).toBeUndefined();
    expect(() => normalizeStructureEntityId("not-a-number")).toThrow();
    expect(() => normalizeStructureEntityId("9007199254740993")).toThrow("cannot be represented");
  });
});
