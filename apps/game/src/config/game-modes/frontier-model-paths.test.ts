import { expect, it } from "vitest";
import {
  BuildingType,
  FRONTIER_BUILDING_TYPES,
  RealmLevels,
  StructureType,
  BUILDINGS_CENTER,
} from "@bibliothecadao/types";
import { getGameModeConfig } from "./index";
import { GAME_FAMILIES } from "../../../../../config/source/common/native-preset-modes";
import { buildingModelPaths, BUILDINGS_GROUPS, getStructureModelPaths } from "@/three/constants/scene-constants";
import { resolveBuildingModelSelection } from "@/three/scenes/hexception-building-model";
import { frontierPaintedBuildingPath, frontierPaintedPath } from "@/three/structures/frontier-painted-buildings";
import { aspectWonderKitPath } from "@/three/structures/realm-kit";

it("gives every Frontier building its own distinct model without changing other modes", () => {
  const frontier = getGameModeConfig(GAME_FAMILIES.frontier).assets;
  const seen = new Map<string, BuildingType>();

  for (const type of FRONTIER_BUILDING_TYPES) {
    const resolved = frontierPaintedBuildingPath(type);
    expect(resolved, BuildingType[type]).toBeTruthy();
    expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBe(resolved);
    expect(
      seen.has(resolved!),
      `${BuildingType[type]} shares ${resolved} with ${BuildingType[seen.get(resolved!)!]}`,
    ).toBe(false);
    seen.set(resolved!, type);
  }

  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.Storehouse]).toBe(
    "/models/frontier/buildings/storeroom.glb",
  );
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.RationsDepot]).toBe(
    "/models/frontier/buildings/rations-depot.glb",
  );
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceCrossbowmanT1]).toBe(
    "/models/frontier/buildings/crossbow-range.glb",
  );

  const baseBuildings: Partial<Record<BuildingType, string>> = buildingModelPaths()[BUILDINGS_GROUPS.BUILDINGS];
  for (const family of [GAME_FAMILIES.blitz]) {
    expect(getGameModeConfig(family).assets.structureModelPaths).toEqual(getStructureModelPaths());
    for (const type of FRONTIER_BUILDING_TYPES) {
      expect(getGameModeConfig(family).assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type]).toBe(
        baseBuildings[type],
      );
    }
  }
  expect(frontier.structureModelPaths[StructureType.Camp]).toEqual([
    frontierPaintedPath("camp"),
    ...getStructureModelPaths()[StructureType.Camp].slice(1),
  ]);
  expect(frontier.structureModelPaths[StructureType.Camp].at(-2)).toBe(frontierPaintedPath("supply-yard"));
  expect(frontier.structureModelPaths[StructureType.Rift]).toEqual([
    frontierPaintedPath("essence-rift"),
    ...getStructureModelPaths()[StructureType.Rift].slice(1),
  ]);
  expect(frontier.structureModelPaths[StructureType.Realm]).toEqual(getStructureModelPaths()[StructureType.Realm]);
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

it("selects all five painted tiers while keeping Storeroom on its own model and retaining Blitz tier policy", () => {
  for (const type of [BuildingType.ResourceWheat, BuildingType.ResourceLabor, BuildingType.ResourceKnightT1]) {
    for (const tier of [1, 2, 3, 4, 5]) {
      const selected = resolveBuildingModelSelection(
        { category: type, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier },
        { stage: 0, structureId: 1, wonder: false, frontier: true },
      );
      expect(
        selected.tierPath ??
          getGameModeConfig(GAME_FAMILIES.frontier).assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type],
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
  ).toBe("/models/frontier/buildings/storeroom.glb");
  expect(
    resolveBuildingModelSelection(
      { category: BuildingType.Storehouse, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 3 },
      { stage: 0, structureId: 1, wonder: false, frontier: false },
    ).tierPath,
  ).toBe("/models/frontier/buildings/storehouse-3.glb");
  expect(getGameModeConfig(GAME_FAMILIES.frontier).assets.buildingModelPaths[BUILDINGS_GROUPS.REALMS].Kingdom).toBe(
    buildingModelPaths()[BUILDINGS_GROUPS.REALMS].Kingdom,
  );
  const frontierWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 2, structureId: 1003, wonder: true, aspect: 1, frontier: true },
  );
  expect(frontierWonder.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Kingdom));
  const frontierEmpireWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 3, structureId: 1003, wonder: true, aspect: 1, frontier: true },
  );
  expect(frontierEmpireWonder.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Empire));
  const blitzWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 2, structureId: 1003, wonder: true, aspect: 1, frontier: false },
  );
  expect(blitzWonder.tierPath).toBe("/models/realms/twin-guardians.glb");
});
