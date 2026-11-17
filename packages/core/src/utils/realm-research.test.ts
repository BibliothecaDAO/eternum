import { describe, expect, it } from "vitest";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import {
  buildingTypeTier,
  learnResearch,
  realmLearned,
  researchedDepth,
  researchPicks,
  researchPurchases,
  researchTier,
} from "./realm-research";

// Matches the Cairo packing test, with independent Farm side counts.
const learned =
  1n + // Farm Fields uncommon
  (1n << 3n) + // Farm Granary uncommon
  (1n << 7n) + // Workshop uncommon, Tools
  (1n << 46n) + // Shrine
  (2n << 48n); // Ethereal II

const store = (value: bigint | undefined) =>
  ({ get: () => (value === undefined ? undefined : { game_id: 7, structure_id: 9, learned: value }) }) as never;

describe("realm research", () => {
  it("reads each row's tier from the chain's packing", () => {
    expect(researchTier(learned, research.ROW_FARM)).toBe(1);
    expect(researchTier(learned, research.ROW_WORKSHOP)).toBe(1);
    expect(researchTier(learned, research.ROW_SUPPLY_YARD)).toBe(0);
    expect(researchTier(learned, research.ROW_SHRINE)).toBe(1);
    expect(researchTier(learned, research.ROW_WELL)).toBe(0);
    expect(researchTier(learned, research.ROW_DEPTH)).toBe(2);
  });

  it("reads the choice made at each learned tier", () => {
    expect([0, 1].map((side) => researchPicks(learned, research.ROW_FARM, side))).toEqual([1, 1]);
    expect(researchPurchases(learned, research.ROW_FARM)).toBe(2);
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
    const well = learnResearch(learned, research.ROW_WELL, 0);
    expect(researchTier(well, research.ROW_WELL)).toBe(1);
    expect(well - learned).toBe(1n << 47n);
    expect(() => learnResearch(learned, research.ROW_WELL, 1)).toThrow("Invalid research side");
    expect(() => learnResearch(well, research.ROW_WELL, 0)).toThrow("Research side is complete");
  });
});

it("keeps both town rows independent of every other packed research field", () => {
  for (let camp = 0; camp <= 5; camp++)
    for (let depot = 0; depot <= 5; depot++) {
      let value = learned;
      for (let i = 0; i < camp; i++) value = learnResearch(value, research.ROW_CONSCRIPTION, 0);
      for (let i = 0; i < depot; i++) value = learnResearch(value, research.ROW_RATIONS, 0);
      expect(researchTier(value, research.ROW_CONSCRIPTION)).toBe(camp);
      expect(researchTier(value, research.ROW_RATIONS)).toBe(depot);
      expect(researchTier(value, research.ROW_FARM)).toBe(1);
      expect(researchTier(value, research.ROW_WORKSHOP)).toBe(1);
      expect(researchTier(value, research.ROW_DEPTH)).toBe(2);
    }
});

it("keeps all troop slot ladders independent with one free slot and three purchases", async () => {
  const { oathResearchRow, troopOathSlots, RESEARCH_ROWS } = await import("./realm-research");
  const { TROOP_TYPES } = await import("@bibliothecadao/types");
  let value = 0n;
  for (const troop of TROOP_TYPES) {
    expect(troopOathSlots(value, troop)).toBe(1);
    for (let count = 2; count <= 4; count++) {
      value = learnResearch(value, oathResearchRow[troop], 0);
      expect(troopOathSlots(value, troop)).toBe(count);
    }
    expect(() => learnResearch(value, oathResearchRow[troop], 0)).toThrow("Research side is complete");
  }
  expect(TROOP_TYPES.map((troop) => troopOathSlots(value, troop))).toEqual([4, 4, 4]);
  for (const row of RESEARCH_ROWS.filter((row) => !Object.values(oathResearchRow).some((oath) => oath === row)))
    expect(researchTier(value, row)).toBe(0);
  expect(value).toBe((3n << 30n) + (3n << 32n) + (3n << 34n));
});
