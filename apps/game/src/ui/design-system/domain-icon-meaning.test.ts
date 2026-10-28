import { describe, expect, it } from "vitest";
import { BuildingType, ResourcesIds, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { campBeside, SITE } from "@/ui/features/frontier/sites/site-fixture";
import { nativeStoryVariants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import {
  beastMeaning,
  buildingMeaning,
  readStructureMeaning,
  storyMeaning,
  structureMeaning,
} from "./domain-icon-meaning";
import { iconDefinition, resourceMeaning } from "./icon-meaning";

describe("story icon meanings", () => {
  it("paints every story the game can emit, and refuses one it cannot", () => {
    for (const story of [...nativeStoryVariants, "BattleEvent", "RaidEvent"])
      expect(iconDefinition(storyMeaning(story)).label, story).toBeTruthy();
    expect(() => storyMeaning("Unknown")).toThrow("Unknown story icon: Unknown");
  });
});

describe("guard and site icon meanings", () => {
  it("keeps Blitz camps as sites and Frontier camps as Trolls in every category caller", () => {
    expect(structureMeaning(StructureType.Camp, "blitz", "troll")).toBe("camp");
    expect(structureMeaning(StructureType.Camp, "frontier")).toBe("beast-troll");
    expect(structureMeaning(StructureType.Beasts, "frontier")).toBe("beast-cyclops");
    expect(structureMeaning(StructureType.Beasts, "frontier", "wraith")).toBe("beast-wraith");
    expect(structureMeaning(StructureType.Rift, "frontier")).toBe("beast-dark-fey");
    for (const species of ["ammit", "basilisk", "wyvern", "hydra"] as const)
      expect(structureMeaning(StructureType.Ruin, "frontier", species)).toBe(beastMeaning(species));
  });

  it("rejects encounter IDs that cannot be represented by the numeric reader", () => {
    const { store } = campBeside("Beasts");
    const game = store.require("GameRegistry", { game_id: 1 });
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 5 } }]);
    const structure = store.require("Structure", { game_id: 1, entity_id: SITE });
    expect(() => readStructureMeaning(store, { ...structure, entity_id: 9007199254740993n })).toThrow(
      "Native integer cannot be represented as a JavaScript number: 9007199254740993",
    );
  });

  it("reads the actual encounter band from native facts, unaffected by casualties, and ignores it in Blitz", () => {
    const { store } = campBeside("Beasts");
    const game = store.require("GameRegistry", { game_id: 1 });
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 5 } }]);
    const structure = store.require("Structure", { game_id: 1, entity_id: SITE });
    const site = store.require("ExpeditionSite", { game_id: 1, entity_id: SITE });
    const bounds = {
      game_id: 1,
      depth: 0,
      beast_weak_lower: 300,
      beast_weak_upper: 350,
      beast_strong_lower: 450,
      beast_strong_upper: 550,
      site_guard_lower: 1000,
      site_guard_upper: 1600,
      reveal_site_neighbors: false,
      entry_stamina: 0,
      reveal_percent: 10,
      chest: { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
      ruin_guard_lower: 2000,
      ruin_guard_upper: 4000,
      guard_step: 100,
    };
    store.applyFacts([{ model: "DepthRules", key: "0x777", value: bounds }]);
    for (const [count, expected] of [
      [bounds.beast_weak_lower, "beast-cyclops"],
      [bounds.beast_strong_lower, "beast-wraith"],
    ] as const) {
      store.applyFacts([
        {
          model: "ExpeditionSite",
          key: "0x72",
          value: { ...site, row: 2, initial_guard_count: BigInt(count) * BigInt(RESOURCE_PRECISION) },
        },
      ]);
      expect(readStructureMeaning(store, structure)).toBe(expected);
      const guard = store.require("Guard", { game_id: 1, structure_id: SITE, slot: 0 });
      store.applyFacts([{ model: "Guard", key: "0x73", value: { ...guard, troops: { ...guard.troops, count: 1n } } }]);
      expect(readStructureMeaning(store, structure)).toBe(expected);
    }
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 2 } }]);
    expect(readStructureMeaning(store, structure)).toBe("beasts");
    expect(
      readStructureMeaning(store, { ...structure, base: { ...structure.base, category: StructureType.Camp } }),
    ).toBe("camp");
  });
});

describe("a building's painting", () => {
  it("paints each building one way everywhere: its own painting, else what it makes, Frontier's barracks as Barracks", () => {
    expect(buildingMeaning(BuildingType.WorkersHut)).toBe("workers-hut");
    expect(buildingMeaning(BuildingType.Storehouse)).toBe("storehouse");
    expect(buildingMeaning(BuildingType.ResourceDonkey)).toBe(resourceMeaning(ResourcesIds.Donkey));
    expect(buildingMeaning(BuildingType.ResourceKnightT1)).toBe(resourceMeaning(ResourcesIds.Knight));
    expect(buildingMeaning(BuildingType.ResourceKnightT1, true)).toBe("barracks");
    expect(() => buildingMeaning(BuildingType.None)).toThrow("has no painting");
  });
});
