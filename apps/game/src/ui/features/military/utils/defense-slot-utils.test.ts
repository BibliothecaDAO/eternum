import { StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getStructureDefenseSlotLimit } from "./defense-slot-utils";

afterEach(() => vi.restoreAllMocks());

describe("a structure's guard slots", () => {
  it("are one more than its level for a realm or a village, and unknown until the level is", () => {
    expect(getStructureDefenseSlotLimit(StructureType.Realm, 2)).toBe(3);
    expect(getStructureDefenseSlotLimit(StructureType.Village, 0n)).toBe(1);
    expect(getStructureDefenseSlotLimit(StructureType.Realm, null)).toBeNull();
  });

  it("are the world's fixed count for every other category, a Frontier site's one guard included", () => {
    expect(getStructureDefenseSlotLimit(StructureType.Hyperstructure)).toBe(4);
    expect(getStructureDefenseSlotLimit(StructureType.Camp)).toBe(1);
    expect(getStructureDefenseSlotLimit(StructureType.Rift)).toBe(1);
    expect(getStructureDefenseSlotLimit(StructureType.Beasts)).toBe(1);
  });

  it("are unknown, never zero, for a category this build does not know", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getStructureDefenseSlotLimit(250 as StructureType)).toBeNull();
    expect(getStructureDefenseSlotLimit(undefined)).toBeNull();
  });
});
