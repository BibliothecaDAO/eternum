import { expect, it } from "vitest";
import { buildingTypeTier, readFrontierBeast } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId, BuildingType, isFrontierBuilding, StructureType } from "@bibliothecadao/types";
import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";
import { SANDS } from "./spire-scenario";

const townCategories = Object.values(BuildingType).filter(
  (type): type is BuildingType => typeof type === "number" && isFrontierBuilding(type),
);

it("opens a Kingdom with every town building, tier III production and guarded map sites", () => {
  const { store } = paintedBuildingsScenario();
  expect(store.require("Structure", { game_id: 1, entity_id: 7 }).base.level).toBe(2);
  const buildings = [...store.rows("Building")];
  expect(buildings).toHaveLength(townCategories.length + 1);
  expect([...new Set(buildings.map((building) => building.category))].sort()).toEqual([...townCategories].sort());
  for (const category of [BuildingType.ResourceWheat, BuildingType.ResourceLabor]) {
    expect(buildingTypeTier(store, 1, 7, category)).toBe(3);
  }
  // Frontier's sites as its contracts make them: nobody's, standing, guarded.
  for (const [entityId, guard] of [
    [711, 300n],
    [712, 4_000n],
    [713, 1_600n],
  ] as const) {
    expect(store.require("Structure", { game_id: 1, entity_id: entityId }).owner).toBe(0n);
    expect(store.require("ExpeditionSite", { game_id: 1, entity_id: entityId }).clear).toBeNull();
    expect(store.require("Guard", { game_id: 1, structure_id: entityId, slot: 0 }).troops.count).toBe(
      guard * 1_000_000_000n,
    );
  }
  expect(store.require("Structure", { game_id: 1, entity_id: 713 }).base.category).toBe(StructureType.Rift);
  expect(readFrontierBeast(store, 1, 710)?.name).toBe("Wyvern");
  expect(readFrontierBeast(store, 1, 713)?.name).toBe("Fairy");
  for (const entityId of [711, 712, 713]) {
    expect([...store.rows("TileOccupancy")].filter((tile) => tile.entity_id === BigInt(entityId))).toHaveLength(1);
  }
});

it("lays the same Kingdom on beach sand, where palms grow, for the sands lab game", () => {
  const { store } = paintedBuildingsScenario(SANDS);
  const tiles = [...store.rows("TileOpt")];
  expect(tiles.length).toBeGreaterThan(0);
  const beach = BigInt(BiomeTypeToId[BiomeType.Beach]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);
  expect(tiles.every((tile) => BigInt(tile.data) === beach)).toBe(true);
  expect([...store.rows("Building")]).toHaveLength(townCategories.length + 1);
});
