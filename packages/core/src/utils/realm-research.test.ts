import { describe, expect, it } from "vitest";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/balance.gen";
import {
  buildingTypeTier,
  learnResearch,
  realmLearned,
  reachableDepth,
  researchTier,
} from "./realm-research";

const learned = 1n + (1n << 7n) + (2n << 48n);

const store = (value: bigint | undefined) =>
  ({ get: () => (value === undefined ? undefined : { game_id: 7, structure_id: 9, learned: value }) }) as never;

describe("realm research", () => {
  it("reads each row's tier from the chain's packing", () => {
    expect(researchTier(learned, research.ROW_FARM)).toBe(1);
    expect(researchTier(learned, research.ROW_WORKSHOP)).toBe(1);
    expect(researchTier(learned, research.ROW_SUPPLY_YARD)).toBe(0);
    expect(researchTier(learned, research.ROW_LORE)).toBe(research.LORE_SHRINES);
  });

  it("shows a building at its row's tier, and never below the first model", () => {
    for (let tier = 0; tier <= 5; tier++)
      expect(buildingTypeTier(store(BigInt(tier)), 7, 9, research.FARM)).toBe(Math.max(1, tier));
  });

  it("keeps unknown knowledge unknown", () => {
    expect(realmLearned(store(undefined), 7, 9)).toBeUndefined();
    expect(reachableDepth(store(undefined), 7, 9)).toBeUndefined();
    expect(reachableDepth(store(0n), 7, 9)).toBe(0);
    expect(reachableDepth(store(learned), 7, 9)).toBe(0);
    expect(reachableDepth(store(learnResearch(learned, research.ROW_LORE)), 7, 9)).toBe(3);
  });

  it("learns a row's next tier as the chain packs it", () => {
    const farm = learnResearch(learned, research.ROW_FARM);
    expect(researchTier(farm, research.ROW_FARM)).toBe(2);
    expect(farm - learned).toBe(1n);
    const spires = learnResearch(learned, research.ROW_LORE);
    expect(researchTier(spires, research.ROW_LORE)).toBe(research.LORE_SPIRES);
    expect(spires - learned).toBe(1n << 48n);
    expect(() => learnResearch(spires, research.ROW_LORE)).toThrow("Research row is complete");
  });
});

it("keeps both town rows independent of every other packed research field", () => {
  for (let camp = 0; camp <= 5; camp++)
    for (let depot = 0; depot <= 5; depot++) {
      let value = learned;
      for (let i = 0; i < camp; i++) value = learnResearch(value, research.ROW_CONSCRIPTION);
      for (let i = 0; i < depot; i++) value = learnResearch(value, research.ROW_RATIONS);
      expect(researchTier(value, research.ROW_CONSCRIPTION)).toBe(camp);
      expect(researchTier(value, research.ROW_RATIONS)).toBe(depot);
      expect(researchTier(value, research.ROW_FARM)).toBe(1);
      expect(researchTier(value, research.ROW_WORKSHOP)).toBe(1);
      expect(researchTier(value, research.ROW_LORE)).toBe(2);
    }
});

it("keeps all troop slot ladders independent with two free slots and three purchases", async () => {
  const { oathResearchRow, oathSlotResearchTier, troopOathSlots, RESEARCH_ROWS } = await import("./realm-research");
  const { TROOP_TYPES } = await import("@bibliothecadao/types");
  let value = 0n;
  for (const troop of TROOP_TYPES) {
    expect(troopOathSlots(value, troop)).toBe(2);
    for (let count = 3; count <= 5; count++) {
      expect(oathSlotResearchTier(count - 1)).toBe(researchTier(value, oathResearchRow[troop]) + 1);
      value = learnResearch(value, oathResearchRow[troop]);
      expect(troopOathSlots(value, troop)).toBe(count);
    }
    expect(() => learnResearch(value, oathResearchRow[troop])).toThrow("Research row is complete");
  }
  expect(TROOP_TYPES.map((troop) => troopOathSlots(value, troop))).toEqual([5, 5, 5]);
  for (const row of RESEARCH_ROWS.filter((row) => !Object.values(oathResearchRow).some((oath) => oath === row)))
    expect(researchTier(value, row)).toBe(0);
  expect(value).toBe((3n << 30n) + (3n << 32n) + (3n << 34n));
});
