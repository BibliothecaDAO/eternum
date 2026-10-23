import { expect, it } from "vitest";
import { buildingTypeTier } from "@bibliothecadao/eternum";
import { BuildingType, TileOccupier } from "@bibliothecadao/types";
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
});
