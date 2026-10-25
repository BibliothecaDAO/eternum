import { expect, it } from "vitest";
import { BuildingType, StructureType, BUILDINGS_CENTER } from "@bibliothecadao/types";
import { getGameModeConfig } from "./index";
import { buildingModelPaths, BUILDINGS_GROUPS, getStructureModelPaths } from "@/three/constants/scene-constants";
import { resolveBuildingModelSelection } from "@/three/scenes/hexception-building-model";
import { frontierPaintedBuildingPath, frontierPaintedPath } from "@/three/structures/frontier-painted-buildings";

it("uses painted Frontier buildings on the board and in placement preview, without changing other modes", () => {
  const frontier = getGameModeConfig(5).assets;
  const types = [
    BuildingType.ResourceWheat,
    BuildingType.ResourceLabor,
    BuildingType.ResourceKnightT1,
    BuildingType.WorkersHut,
    BuildingType.WarHall,
    BuildingType.SupplyYard,
    BuildingType.ScoutsLodge,
    BuildingType.Hearth,
  ] as const;
  for (const type of types) {
    expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBe(frontierPaintedBuildingPath(type));
  }
  for (const preset of [2, 3]) {
    expect(getGameModeConfig(preset).assets.structureModelPaths).toEqual(getStructureModelPaths());
    for (const type of types) {
      expect(getGameModeConfig(preset).assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBe(
        buildingModelPaths()[BUILDINGS_GROUPS.BUILDINGS][type],
      );
    }
  }
  expect(frontier.structureModelPaths[StructureType.Rift]).toEqual([
    frontierPaintedPath("essence-rift"),
    ...getStructureModelPaths()[StructureType.Rift].slice(1),
  ]);
  for (const type of [StructureType.Camp, StructureType.Realm]) {
    expect(frontier.structureModelPaths[type]).toEqual(getStructureModelPaths()[type]);
  }
  for (const group of [BUILDINGS_GROUPS.REALMS, BUILDINGS_GROUPS.VILLAGE]) {
    expect(frontier.buildingModelPaths[group]).toEqual(buildingModelPaths()[group]);
  }
  expect(frontier.structureModelPaths[StructureType.Ruin].slice(1)).toEqual(
    getStructureModelPaths()[StructureType.Ruin].slice(1),
  );
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceEssence]).toBe(
    frontierPaintedPath("essence-rift"),
  );
  expect(frontier.structureModelPaths[StructureType.Ruin][0]).toBe(frontierPaintedPath("fallen-realm-ruin"));
});

it("selects all five painted tiers while retaining the central keep and the existing non-Frontier tier policy", () => {
  for (const type of [
    BuildingType.ResourceWheat,
    BuildingType.ResourceLabor,
    BuildingType.ResourceKnightT1,
    BuildingType.WorkersHut,
  ]) {
    for (const tier of [1, 2, 3, 4, 5]) {
      const selected = resolveBuildingModelSelection(
        { category: type, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier },
        { stage: 0, structureId: 1, wonder: false, frontier: true },
      );
      expect(
        selected.tierPath ?? getGameModeConfig(5).assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type],
      ).toBe(frontierPaintedBuildingPath(type, tier));
    }
  }
  const keep = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 5 },
    { stage: 2, structureId: 1, wonder: false, frontier: true },
  );
  expect(keep.group).toBe(BUILDINGS_GROUPS.REALMS);
  expect(keep.tierPath).toBeUndefined();
  expect(
    resolveBuildingModelSelection(
      { category: BuildingType.Storehouse, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 3 },
      { stage: 0, structureId: 1, wonder: false, frontier: true },
    ).tierPath,
  ).toBe("/models/frontier/buildings/storehouse-3.glb");
  expect(getGameModeConfig(5).assets.buildingModelPaths[BUILDINGS_GROUPS.REALMS].Kingdom).toBe(
    buildingModelPaths()[BUILDINGS_GROUPS.REALMS].Kingdom,
  );
});
