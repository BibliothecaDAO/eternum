import {
  isRealmOrVillageLikeStructureCategory,
  isVillageLikeStructureCategory,
  normalizeStructureCategory,
} from "@/lib/structure-type-utils";
import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

describe("structure-type-utils", () => {
  it("normalizes structure categories from supported numeric inputs", () => {
    expect(normalizeStructureCategory(StructureType.Camp)).toBe(StructureType.Camp);
    expect(normalizeStructureCategory(BigInt(StructureType.Camp))).toBe(StructureType.Camp);
    expect(normalizeStructureCategory(null)).toBeNull();
  });

  it("treats camps as village-like structures", () => {
    expect(isVillageLikeStructureCategory(StructureType.Village)).toBe(true);
    expect(isVillageLikeStructureCategory(StructureType.Camp)).toBe(true);
    expect(isVillageLikeStructureCategory(StructureType.Realm)).toBe(false);
  });

  it("treats camps as realm-adjacent detail structures", () => {
    expect(isRealmOrVillageLikeStructureCategory(StructureType.Realm)).toBe(true);
    expect(isRealmOrVillageLikeStructureCategory(StructureType.Camp)).toBe(true);
    expect(isRealmOrVillageLikeStructureCategory(StructureType.FragmentMine)).toBe(false);
  });
});
