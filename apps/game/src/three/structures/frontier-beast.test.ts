import { describe, expect, it } from "vitest";
import { StructureType, type TroopType } from "@bibliothecadao/types";
import { getStructureModelPaths } from "../constants/scene-constants";
import {
  FRONTIER_BEASTS,
  FALLEN_REALM_DEPTHS,
  frontierBeast,
  frontierBeastModelIndex,
  readStandingFrontierBeast,
} from "./frontier-beast";

const facts = (category: StructureType, cleared = false, troop: TroopType = "Knight", count = 20n) => {
  const rows = {
    SliceRules: { day_unit_seconds: 86400 },
    GameRegistry: { start_main_at: 0, seed: 1 },
    SettlementRules: { spacing: 10 },
    Structure: { game_id: 1, entity_id: 9, base: { category } },
    ExpeditionSite: {
      game_id: 1,
      entity_id: 9,
      initial_guard_count: 100n,
      clear: cleared ? { explorer_id: 1n, home_id: 7n, reward: null } : null,
    },
    Guard: { troops: { category: troop, tier: "T1", count } },
  };
  return { get: (model: keyof typeof rows) => rows[model] } as never;
};

describe("Frontier guard identity", () => {
  it("keeps the shipped Ruin progression and measured scales", () => {
    expect([0, 1, 2, 3].map((depth) => frontierBeast(depth).name)).toEqual(["Troll", "Wyvern", "Hydra", "Hydra"]);
    for (const { beast, scale } of FALLEN_REALM_DEPTHS)
      expect(scale).toBeLessThanOrEqual(FRONTIER_BEASTS[beast].maxScale);
    expect(() => frontierBeast(4)).toThrow("No Frontier beast");
  });
  it.each([StructureType.Camp, StructureType.Rift, StructureType.Ruin, StructureType.Stragglers])(
    "uses the same live identity to select model and label for site %s",
    (category) => {
      const identity = readStandingFrontierBeast(facts(category), 1, 9, { row: 15 })!;
      expect(identity.name).toBe(category === StructureType.Stragglers ? "Troll" : "Wyvern");
      expect(getStructureModelPaths()[category][frontierBeastModelIndex(identity.beast)]).toBe(
        FRONTIER_BEASTS[identity.beast].path,
      );
      expect(readStandingFrontierBeast(facts(category, true), 1, 9, { row: 15 })).toBeUndefined();
    },
  );
  it.each([
    ["Knight", "troll", 5],
    ["Paladin", "wolf", 5],
    ["Crossbowman", "goblin", 4],
  ] as const)("presents %s Stragglers as %s without changing species after losses", (troop, beast, lootTier) => {
    const read = (count: bigint) =>
      readStandingFrontierBeast(facts(StructureType.Stragglers, false, troop, count), 1, 9, { row: 15 });
    expect(read(100n)?.beast).toBe(beast);
    expect(read(1n)).toEqual(read(100n));
    expect(FRONTIER_BEASTS[beast].lootTier).toBe(lootTier);
  });
  it("does not turn ordinary neutral holdings into Frontier beasts", () => {
    const store = facts(StructureType.Camp) as unknown as { get: (model: string) => unknown };
    const original = store.get;
    store.get = (model) => (model === "ExpeditionSite" ? undefined : original(model));
    expect(readStandingFrontierBeast(store as never, 1, 9, { row: 15 })).toBeUndefined();
    expect(readStandingFrontierBeast(facts(StructureType.Realm), 1, 9, { row: 15 })).toBeUndefined();
  });
});
