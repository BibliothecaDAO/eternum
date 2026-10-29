import { describe, expect, it } from "vitest";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import {
  buildingTypeTier,
  learnResearch,
  realmLearned,
  researchChoice,
  researchedDepth,
  researchPicks,
  researchPurchases,
  researchTier,
} from "./realm-research";

// Matches the Cairo packing test, with independent Farm side counts and ordered Scouts kinds.
const learned =
  1n + // Farm Fields uncommon
  (1n << 3n) + // Farm Granary uncommon
  (1n << 7n) + // Workshop uncommon, Tools
  (3n << 30n) + // Scouts' lodge epic
  (1n << 36n) + // ...first tier on rifts
  (2n << 40n) + // ...third tier on beasts
  (1n << 46n) + // Shrine
  (2n << 48n); // Ethereal II

const store = (value: bigint | undefined) =>
  ({ get: () => (value === undefined ? undefined : { game_id: 7, structure_id: 9, learned: value }) }) as never;

describe("realm research", () => {
  it("reads each row's tier from the chain's packing", () => {
    expect(researchTier(learned, research.ROW_FARM)).toBe(1);
    expect(researchTier(learned, research.ROW_WORKSHOP)).toBe(1);
    expect(researchTier(learned, research.ROW_BARRACKS)).toBe(0);
    expect(researchTier(learned, research.ROW_SCOUTS_LODGE)).toBe(3);
    expect(researchTier(learned, research.ROW_SHRINE)).toBe(1);
    expect(researchTier(learned, research.ROW_WELL)).toBe(0);
    expect(researchTier(learned, research.ROW_DEPTH)).toBe(2);
  });

  it("reads the choice made at each learned tier", () => {
    expect([0, 1].map((side) => researchPicks(learned, research.ROW_FARM, side))).toEqual([1, 1]);
    expect(researchPurchases(learned, research.ROW_FARM)).toBe(2);
    expect([1, 2, 3].map((tier) => researchChoice(learned, research.ROW_SCOUTS_LODGE, tier))).toEqual([
      research.KIND_RIFTS,
      research.KIND_CAMPS,
      research.KIND_BEASTS,
    ]);
    expect(() => researchChoice(learned, research.ROW_FARM, 1)).toThrow("has no choice");
    expect(() => researchChoice(learned, research.ROW_HUT, 1)).toThrow("has no choice");
  });

  it("uses the higher side for building display and retains all ten purchases", () => {
    for (let make = 0; make <= 5; make++)
      for (let other = 0; other <= 5; other++) {
        const value = BigInt(make) | (BigInt(other) << 3n);
        expect(buildingTypeTier(store(value), 7, 9, research.FARM)).toBe(Math.max(1, make, other));
        expect(researchPurchases(value, research.ROW_FARM)).toBe(make + other);
        expect(researchPicks(value, research.ROW_FARM, 0)).toBe(make);
        expect(researchPicks(value, research.ROW_FARM, 1)).toBe(other);
      }
  });

  it("keeps unknown knowledge unknown", () => {
    expect(realmLearned(store(undefined), 7, 9)).toBeUndefined();
    expect(researchedDepth(store(undefined), 7, 9)).toBeUndefined();
    expect(researchedDepth(store(0n), 7, 9)).toBe(0);
    expect(researchedDepth(store(learned), 7, 9)).toBe(2);
  });

  it("learns a row's next tier with its side, as the chain packs it", () => {
    const farmRare = learnResearch(learned, research.ROW_FARM, research.CHOICE_STORE);
    expect(researchPicks(farmRare, research.ROW_FARM, research.CHOICE_MAKE)).toBe(1);
    expect(researchPicks(farmRare, research.ROW_FARM, research.CHOICE_STORE)).toBe(2);
    expect(farmRare - learned).toBe(1n << 3n);
    const scouts = learnResearch(learned, research.ROW_SCOUTS_LODGE, 1);
    expect(researchTier(scouts, research.ROW_SCOUTS_LODGE)).toBe(4);
    expect(researchChoice(scouts, research.ROW_SCOUTS_LODGE, 4)).toBe(1);
    const well = learnResearch(learned, research.ROW_WELL, 0);
    expect(researchTier(well, research.ROW_WELL)).toBe(1);
    expect(well - learned).toBe(1n << 47n);
    expect(() => learnResearch(learned, research.ROW_WELL, 1)).toThrow("Invalid research side");
    expect(() => learnResearch(well, research.ROW_WELL, 0)).toThrow("Research side is complete");
  });
});
