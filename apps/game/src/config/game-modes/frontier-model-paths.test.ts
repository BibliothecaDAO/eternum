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
import { FALLEN_REALM_RUIN_PATH } from "@/three/structures/frontier-beast";
import { aspectWonderKitPath } from "@/three/structures/realm-kit";
import { REALM_SUPPORT_PATHS } from "@/three/structures/realm-support-kit";

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
    REALM_SUPPORT_PATHS.storeroom,
  );
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.RationsDepot]).toBe(
    REALM_SUPPORT_PATHS["rations-depot"],
  );
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceCrossbowmanT1]).toBe(
    REALM_SUPPORT_PATHS["crossbow-range"],
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
    REALM_SUPPORT_PATHS.camp,
    ...getStructureModelPaths()[StructureType.Camp].slice(1),
  ]);
  expect(frontier.structureModelPaths[StructureType.Camp].at(-2)).toBe(REALM_SUPPORT_PATHS["supply-yard"]);
  expect(frontier.structureModelPaths[StructureType.Rift]).toEqual([
    frontierPaintedPath("essence-rift"),
    ...getStructureModelPaths()[StructureType.Rift].slice(1),
  ]);
  expect(frontier.structureModelPaths[StructureType.Realm]).toEqual(getStructureModelPaths()[StructureType.Realm]);
  for (const group of [BUILDINGS_GROUPS.REALMS, BUILDINGS_GROUPS.VILLAGE]) {
    expect(frontier.buildingModelPaths[group]).toEqual(buildingModelPaths()[group]);
  }
  expect(frontier.structureModelPaths[StructureType.Ruin]).toEqual(getStructureModelPaths()[StructureType.Ruin]);
  expect(frontier.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceEssence]).toBe(
    frontierPaintedPath("essence-rift"),
  );
  expect(frontier.structureModelPaths[StructureType.Ruin][0]).toBe(FALLEN_REALM_RUIN_PATH);
});

it("selects all five painted tiers while keeping Storeroom on its own model and retaining Blitz tier policy", () => {
  for (const type of [BuildingType.ResourceWheat, BuildingType.ResourceLabor, BuildingType.ResourceKnightT1]) {
    for (const tier of [1, 2, 3, 4, 5]) {
      const selected = resolveBuildingModelSelection(
        { category: type, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier },
        { stage: 0, wonder: false, frontier: true },
      );
      expect(
        selected.tierPath ??
          getGameModeConfig(GAME_FAMILIES.frontier).assets.buildingModelPaths[BUILDINGS_GROUPS.BUILDINGS][type],
      ).toBe(frontierPaintedBuildingPath(type, tier));
    }
  }
  const keep = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 5 },
    { stage: 2, wonder: false, frontier: true },
  );
  expect(keep.group).toBe(BUILDINGS_GROUPS.REALMS);
  expect(keep.tierPath).toBeUndefined();
  expect(
    resolveBuildingModelSelection(
      { category: BuildingType.Storehouse, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 3 },
      { stage: 0, wonder: false, frontier: true },
    ).tierPath,
  ).toBe(REALM_SUPPORT_PATHS.storeroom);
  expect(
    resolveBuildingModelSelection(
      { category: BuildingType.Storehouse, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 3 },
      { stage: 0, wonder: false, frontier: false },
    ).tierPath,
  ).toBe(REALM_SUPPORT_PATHS["storehouse-3"]);
  expect(getGameModeConfig(GAME_FAMILIES.frontier).assets.buildingModelPaths[BUILDINGS_GROUPS.REALMS].Kingdom).toBe(
    buildingModelPaths()[BUILDINGS_GROUPS.REALMS].Kingdom,
  );
  const frontierWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 2, wonder: true, aspect: 1, frontier: true },
  );
  expect(frontierWonder.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Kingdom));
  const frontierEmpireWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 3, wonder: true, aspect: 1, frontier: true },
  );
  expect(frontierEmpireWonder.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Empire));
  const blitzWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 2, wonder: true, aspect: 1, frontier: false },
  );
  expect(blitzWonder.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Kingdom));
  const unalignedWonder = resolveBuildingModelSelection(
    { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], tier: 1 },
    { stage: 2, wonder: true, aspect: null, frontier: false },
  );
  expect(unalignedWonder.tierPath).toBeUndefined();
});
