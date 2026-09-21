import { afterEach, expect, it, vi } from "vitest";
import { Matrix4, Scene, Vector3 } from "three";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import preset from "../../../../../contracts/l3/world-native/fixtures/preset-1.json";

vi.mock("../scenes/hexagon-scene", () => ({ CameraView: { Close: 1, Medium: 2, Far: 3 } }));
vi.mock("../utils/utils", () => ({ gltfLoader: { loadAsync: vi.fn() } }));
vi.mock("../utils", () => ({ getWorldPositionForHex: () => new Vector3(1, 0, 2) }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("../utils/labels/label-factory", () => ({ createChestLabel: vi.fn() }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: vi.fn() } }));

import { ChestManager } from "./chest-manager";

type PlacementHarness = {
  initializePointsRenderer(): void;
  addChestInstance(chest: unknown): void;
  chestModel?: unknown;
  visibleChests: unknown[];
};

afterEach(() => vi.restoreAllMocks());

it("moves a placed chest onto terrain that arrives later, and only when its height changed", () => {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  store.applyEntityOperations([
    { type: "upsert", entities: [{ hashed_keys: "0x1", models: { SliceRules: { ...preset.rules, game_id: 1 } } }] },
  ]);
  configManager.setStore(store);
  vi.spyOn(ChestManager.prototype as unknown as PlacementHarness, "initializePointsRenderer").mockImplementation(
    () => {},
  );
  let height = 0;
  const scene = {
    getCurrentCameraView: () => 2,
    addCameraViewListener: vi.fn(),
    removeCameraViewListener: vi.fn(),
    getTerrainSurface: () => ({ sampleSurface: () => ({ biome: null, height, normal: [0, 1, 0] }) }),
  };
  const projection = { subscribeChests: () => () => {} } as unknown as WorldSpatialProjection;
  const manager = new ChestManager(new Scene(), { width: 24, height: 24 }, projection, undefined, scene as never);
  const harness = manager as unknown as PlacementHarness;
  const placedHeights: number[] = [];
  harness.chestModel = {
    setMatrixAt: (_index: number, matrix: Matrix4) => placedHeights.push(matrix.elements[13]),
    dispose: vi.fn(),
  };
  const chest = { entityId: 7, hexCoords: { col: 10, row: 10 } };
  harness.visibleChests = [chest];
  harness.addChestInstance(chest);
  expect(placedHeights.at(-1)).toBeCloseTo(0.08);

  manager.refreshTerrainPlacement();
  expect(placedHeights).toHaveLength(1);

  height = 0.12;
  manager.refreshTerrainPlacement();
  expect(placedHeights).toHaveLength(2);
  expect(placedHeights.at(-1)).toBeCloseTo(0.2);

  manager.refreshTerrainPlacement();
  expect(placedHeights).toHaveLength(2);
  manager.destroy();
});
