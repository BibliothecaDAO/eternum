import { expect, it } from "vitest";
import { buildingTypeTier, readFrontierBeast } from "@bibliothecadao/eternum";
import { BuildingType, StructureType, TileOccupier } from "@bibliothecadao/types";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";

it("opens a Kingdom with eight distinct buildings, tier III production and two usable map sites", () => {
  const { store } = paintedBuildingsScenario();
  expect(store.require("Structure", { game_id: 1, entity_id: 7 }).base.level).toBe(2);
  const buildings = [...store.rows("Building")];
  expect(buildings).toHaveLength(9);
  expect(new Set(buildings.map((building) => building.category)).size).toBe(8);
  for (const category of [
    BuildingType.ResourceWheat,
    BuildingType.ResourceLabor,
    BuildingType.ResourceKnightT1,
    BuildingType.WorkersHut,
  ]) {
    expect(buildingTypeTier(store, 1, 7, category)).toBe(3);
  }
  for (const category of [TileOccupier.Shrine, TileOccupier.Well]) {
    expect([...store.rows("TileOccupancy")].filter((tile) => tile.category === category)).toHaveLength(1);
  }
  expect(store.require("Structure", { game_id: 1, entity_id: 711 }).owner).toBe(0x111n);
  expect(store.require("Structure", { game_id: 1, entity_id: 712 }).owner).toBe(0x222n);
  expect(store.require("Structure", { game_id: 1, entity_id: 713 }).base.category).toBe(StructureType.Rift);
  expect(readFrontierBeast(store, 1, 710)?.beast).toBe("ammit");
  expect(readFrontierBeast(store, 1, 713)?.beast).toBe("dark-fey");
  for (const entityId of [711, 712, 713]) {
    expect([...store.rows("TileOccupancy")].filter((tile) => tile.entity_id === BigInt(entityId))).toHaveLength(1);
  }
});
