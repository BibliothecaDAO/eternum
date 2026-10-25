// @vitest-environment jsdom
import { BUILDINGS_CENTER, BuildingType, StructureType } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { FRONTIER_PRESET_ID } from "../../../../../config/source/common/native-preset-modes";

const { getGameModeConfig } = await import("@/config/game-modes");
const { default: HexceptionScene } = await import("./hexception");

/**
 * A Frontier realm's board as the grid build lays it out, the scene recording each model file it asks for instead of
 * fetching it: what a player's first press of Realm downloads before the realm is shown.
 */
const realmBoard = (buildings: Array<{ col: number; row: number; category: BuildingType; tier?: number }>) => {
  const requested: string[] = [];
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    mode: getGameModeConfig(FRONTIER_PRESET_ID),
    state: { structureEntityId: 7 },
    structureStage: 0,
    tileManager: { getWonder: () => undefined },
    buildings,
    models: {
      request: (path: string) => {
        requested.push(path);
        return Promise.resolve();
      },
    },
  });
  return { scene, requested };
};

it("loads the models a realm's keep and buildings draw, each once and at its tier, and no other", async () => {
  const board = realmBoard([
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], category: BuildingType.ResourceLabor },
    { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], category: BuildingType.ResourceWheat },
    { col: BUILDINGS_CENTER[0] - 1, row: BUILDINGS_CENTER[1], category: BuildingType.ResourceWheat },
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] + 1, category: BuildingType.ResourceWheat, tier: 3 },
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] - 1, category: BuildingType.WorkersHut },
  ]);

  await board.scene.loadLaidOutModels(StructureType.Realm);

  expect(board.requested.toSorted()).toEqual([
    "/models/frontier/painted/farm-1.glb",
    "/models/frontier/painted/farm-3.glb",
    "/models/frontier/painted/workers-hut-1.glb",
    "/models/realms/settlement.glb",
  ]);
});
