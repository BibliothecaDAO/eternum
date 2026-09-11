import { afterEach, expect, it, vi } from "vitest";
import { Scene } from "three";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

vi.mock("../scenes/hexagon-scene", () => ({ CameraView: { Close: 1, Medium: 2, Far: 3 } }));
vi.mock("../utils/utils", () => ({ gltfLoader: { loadAsync: vi.fn() } }));
vi.mock("../utils", () => ({ getWorldPositionForHex: vi.fn() }));
vi.mock("../utils/labels/label-factory", () => ({ createChestLabel: vi.fn() }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: vi.fn() } }));

import { ChestManager } from "./chest-manager";

type PreparationHarness = {
  initializePointsRenderer(): void;
  loadModel(): Promise<void>;
  requestVisibleChestsRefresh(chunk: string): Promise<void>;
  chestModel?: unknown;
};

function createManager() {
  vi.spyOn(ChestManager.prototype as unknown as PreparationHarness, "initializePointsRenderer").mockImplementation(
    () => {},
  );
  const projection = { subscribeChests: () => () => {} } as unknown as WorldSpatialProjection;
  return new ChestManager(new Scene(), { width: 24, height: 24 }, projection);
}

afterEach(() => vi.restoreAllMocks());

it("defers chest preparation until its chunk stage and shares it across overlapping requests", async () => {
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const load = vi.spyOn(ChestManager.prototype as unknown as PreparationHarness, "loadModel").mockReturnValue(ready);
  const manager = createManager();
  const refresh = vi.spyOn(manager as unknown as PreparationHarness, "requestVisibleChestsRefresh").mockResolvedValue();
  expect(load).not.toHaveBeenCalled();

  const first = manager.updateChunk("0,0", { transitionToken: 1 });
  const second = manager.updateChunk("0,24", { transitionToken: 2 });
  expect(load).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
  (manager as unknown as PreparationHarness).chestModel = {};
  finish();
  await Promise.all([first, second]);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledWith("0,24");
  await manager.updateChunk("0,48", { transitionToken: 3 });
  expect(load).toHaveBeenCalledTimes(1);
});

it("does not refresh or start another load after destruction during preparation", async () => {
  let finish!: () => void;
  const load = vi.spyOn(ChestManager.prototype as unknown as PreparationHarness, "loadModel").mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const manager = createManager();
  const refresh = vi.spyOn(manager as unknown as PreparationHarness, "requestVisibleChestsRefresh").mockResolvedValue();
  const pending = manager.updateChunk("0,0");
  manager.destroy();
  finish();
  await pending;
  await manager.updateChunk("0,24");
  expect(refresh).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(1);
});

it("retries failed preparation without treating the failed chunk as committed", async () => {
  const failure = new Error("model unavailable");
  const load = vi
    .spyOn(ChestManager.prototype as unknown as PreparationHarness, "loadModel")
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce();
  const manager = createManager();
  const refresh = vi.spyOn(manager as unknown as PreparationHarness, "requestVisibleChestsRefresh").mockResolvedValue();
  await expect(manager.updateChunk("0,0")).rejects.toBe(failure);
  expect(refresh).not.toHaveBeenCalled();
  await manager.updateChunk("0,0");
  expect(load).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledWith("0,0");
});
