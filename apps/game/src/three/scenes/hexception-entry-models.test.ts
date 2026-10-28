// @vitest-environment jsdom
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { DEVCON } from "@/shell/join/devcon";
import { BUILDINGS_CENTER, BuildingType, StructureType } from "@bibliothecadao/types";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FRONTIER_PRESET_ID } from "../../../../../config/source/common/native-preset-modes";

// A model as the loader hands it over: one mesh, standing for a building's file.
const loaded = vi.hoisted(() => ({ scene: null as unknown }));
vi.mock("@/three/utils/gltf-loader", () => ({
  gltfLoader: { loadAsync: async () => ({ scene: loaded.scene, animations: [] }) },
}));

const { getGameModeConfig } = await import("@/config/game-modes");
const { default: HexceptionScene } = await import("./hexception");

beforeEach(() => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
});
afterEach(() => vi.restoreAllMocks());

/**
 * A Frontier realm's board as the grid build lays it out, the scene recording each model file it asks for instead of
 * fetching it: what a player's first press of Realm downloads before the realm is shown.
 */
const realmBoard = (buildings: Array<{ col: number; row: number; category: BuildingType; tier?: number }>) => {
  const requested: string[] = [];
  const store = new NativeFactStore();
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    game: { store },
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
  return { scene, requested, store };
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

it.each([
  { tier: 1, directory: "regular" },
  { tier: 2, directory: "gold" },
])("loads the $directory Devcon keep from the home's confirmed campaign identity", async ({ tier, directory }) => {
  const board = realmBoard([
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], category: BuildingType.ResourceLabor },
  ]);
  board.store.applyFacts([
    {
      model: "CampaignHome",
      key: "0x7",
      value: {
        game_id: configManager.getActiveGameId(),
        home: "7",
        campaign_id: shortString.encodeShortString(DEVCON.campaign),
        tier,
      },
    },
  ]);

  await board.scene.loadLaidOutModels(StructureType.Realm);

  expect(board.requested).toEqual([`/models/realms/devcon/${directory}/settlement.glb`]);
});

it("compiles a loaded model's pipelines against the realm scene before it hands the model to the board", async () => {
  const model = new Group().add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  loaded.scene = model;
  const events: string[] = [];
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    destroyed: false,
    scene: { name: "realm scene" },
    settlementPresentations: new Map(),
    compilePipelines: async (object: unknown, target: unknown) => {
      events.push(object === model && target === scene.scene ? "compiled against the realm" : "compiled elsewhere");
    },
  });

  const building = await scene.loadBuildingModel("/models/frontier/painted/farm-1.glb");
  events.push("handed to the board");

  expect(building.model).toBe(model);
  expect(events).toEqual(["compiled against the realm", "handed to the board"]);
});
