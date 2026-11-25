// @vitest-environment jsdom
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER, BuildingType, StructureType } from "@bibliothecadao/types";
import { Box3, Group, Mesh, MeshStandardMaterial, BoxGeometry } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { GAME_FAMILIES } from "../../../../../config/source/common/native-preset-modes";

// A model as the loader hands it over: one mesh, standing for a building's file.
const loaded = vi.hoisted(() => ({ scene: null as unknown }));
vi.mock("@/three/utils/gltf-loader", () => ({
  gltfLoader: { loadAsync: async () => ({ scene: loaded.scene, animations: [] }) },
}));

const route = vi.hoisted(() => ({ tiles: null as unknown }));
vi.mock("@/play/navigation/play-route-target", () => ({
  resolvePlayRouteTarget: () => ({ hexRealmPosition: { col: 3, row: 4 }, routeWorldPosition: { col: 3, row: 4 } }),
}));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ views: { buildingTiles: () => route.tiles } }),
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
    mode: getGameModeConfig(GAME_FAMILIES.frontier),
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
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] - 1, category: BuildingType.ResourceKnightT1 },
  ]);

  await board.scene.loadLaidOutModels(StructureType.Realm);

  expect(board.requested.toSorted()).toEqual([
    "/models/frontier/painted/barracks-1.glb",
    "/models/frontier/painted/farm-1.glb",
    "/models/frontier/painted/farm-3.glb",
    "/models/realms/settlement.glb",
  ]);
});

it("compiles a loaded model's pipelines against the realm scene before it hands the model to the board", async () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  loaded.scene = new Group().add(mesh);
  let finishCompile!: () => void;
  const compilation = new Promise<void>((resolve) => {
    finishCompile = resolve;
  });
  const compilePipelines = vi.fn(() => compilation);
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    destroyed: false,
    scene: { name: "realm scene" },
    settlementPresentations: new Map(),
    compilePipelines,
  });

  let handedToBoard = false;
  const loading = scene.loadBuildingModel("/models/frontier/painted/farm-1.glb").then((building: { model: Group }) => {
    handedToBoard = true;
    return building;
  });
  await vi.waitFor(() => expect(compilePipelines).toHaveBeenCalledTimes(1));
  expect(handedToBoard).toBe(false);
  finishCompile();
  const building = await loading;

  expect(compilePipelines).toHaveBeenCalledWith(building.model, scene.scene);
  expect(building.model.getObjectById(mesh.id)).toBe(mesh);
  expect(new Box3().setFromObject(building.model, true).min.y).toBeCloseTo(0, 6);
});

it("asks for the route realm's models while the camera flies to it, the same ones its board then lays out", () => {
  const buildings = [
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], category: BuildingType.ResourceLabor },
    { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], category: BuildingType.ResourceWheat, tier: 3 },
    { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] - 1, category: BuildingType.ResourceKnightT1 },
  ];
  route.tiles = {
    existingBuildings: () => buildings.map((building) => ({ ...building })),
    structureType: () => StructureType.Realm,
    getRealmLevel: () => 0,
    getWonder: () => undefined,
  };
  const board = realmBoard(buildings);
  board.scene.readRouteStructure = () => ({ entity_id: 7 });

  board.scene.prepareWhileFlying();

  expect(board.requested.toSorted()).toEqual([
    "/models/frontier/painted/barracks-1.glb",
    "/models/frontier/painted/farm-3.glb",
    "/models/realms/settlement.glb",
  ]);
});
