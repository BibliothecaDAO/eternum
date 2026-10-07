import { describe, expect, it } from "vitest";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import { realmLearned, researchChoice, researchedDepth, researchTier } from "./realm-research";

// research.cairo's learn(): a row's tier counts up in its field, and each tier's choice follows the row's tier field.
const learned =
  2n + // Farm rare
  (1n << 4n) + // Farm's second tier took Granary
  (1n << 7n) + // Workshop uncommon, Tools
  (3n << 30n) + // Scouts' lodge epic
  (1n << 36n) + // ...first tier on rifts
  (2n << 40n) + // ...third tier on stragglers
  (1n << 44n) + // Shrine
  (2n << 46n); // Ethereal II

const store = (value: bigint | undefined) =>
  ({ get: () => (value === undefined ? undefined : { game_id: 7, structure_id: 9, learned: value }) }) as never;

describe("realm research", () => {
  it("reads each row's tier from the chain's packing", () => {
    expect(researchTier(learned, research.ROW_FARM)).toBe(2);
    expect(researchTier(learned, research.ROW_WORKSHOP)).toBe(1);
    expect(researchTier(learned, research.ROW_BARRACKS)).toBe(0);
    expect(researchTier(learned, research.ROW_SCOUTS_LODGE)).toBe(3);
    expect(researchTier(learned, research.ROW_SHRINE)).toBe(1);
    expect(researchTier(learned, research.ROW_WELL)).toBe(0);
    expect(researchTier(learned, research.ROW_DEPTH)).toBe(2);
  });

  it("reads the choice made at each learned tier", () => {
    expect([1, 2].map((tier) => researchChoice(learned, research.ROW_FARM, tier))).toEqual([
      research.CHOICE_MAKE,
      research.CHOICE_STORE,
    ]);
    expect([1, 2, 3].map((tier) => researchChoice(learned, research.ROW_SCOUTS_LODGE, tier))).toEqual([
      research.KIND_RIFTS,
      research.KIND_CAMPS,
      research.KIND_STRAGGLERS,
    ]);
    expect(() => researchChoice(learned, research.ROW_FARM, 3)).toThrow("has not learned tier 3");
    expect(() => researchChoice(learned, research.ROW_HUT, 1)).toThrow("has no choice");
  });

  it("keeps unknown knowledge unknown", () => {
    expect(realmLearned(store(undefined), 7, 9)).toBeUndefined();
    expect(researchedDepth(store(undefined), 7, 9)).toBeUndefined();
    expect(researchedDepth(store(0n), 7, 9)).toBe(0);
    expect(researchedDepth(store(learned), 7, 9)).toBe(2);
  });
});
