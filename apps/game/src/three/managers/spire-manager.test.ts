// @vitest-environment jsdom
import { TileOccupier } from "@bibliothecadao/types";
import { Group, PerspectiveCamera, Scene, SphereGeometry } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { describe, expect, it, vi } from "vitest";

const { placed, loadAsync } = vi.hoisted(() => ({ placed: [] as boolean[], loadAsync: vi.fn(async () => ({})) }));
vi.mock("../utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/utils")>()),
  gltfLoader: { loadAsync },
}));
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { subscribe: () => () => {} } }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("../structures/spire-model", () => ({
  SpireModel: class {
    group = new Group();
    labelHeight = 2;
    orbGeometry = new SphereGeometry(1);
    setOrbScale = () => {};
    getOrbTransform = () => false;
    placeSpire = (_index: number, _matrix: unknown, dormant: boolean) => void placed.push(dormant);
    setCount = () => {};
    needsUpdate = () => {};
    dispose = () => {};
    updateAnimations = () => {};
  },
}));

import { endgameFrame } from "../effects/endgame/sequence";
import { SpireManager } from "./spire-manager";

const tile = (col: number, occupierType: number) => ({ hexCoords: { col, row: 0 }, occupierType });

describe("spires on the map", () => {
  it("names a working spire over its model and leaves a dormant one unlabelled, as scenery", async () => {
    const projection = {
      getTiles: () => [tile(1, TileOccupier.Spire), tile(2, TileOccupier.DormantSpire)],
      subscribeTiles: () => () => {},
    };
    const labels = new Group();
    const manager = new SpireManager(new Scene(), projection as never, labels);
    await manager.prepare();
    expect(placed.slice(0, 2)).toEqual([false, true]);
    const names = labels.children.map((label) => (label as CSS2DObject).element.textContent);
    expect(names).toEqual(["Spire"]);
    manager.destroy();
  });

  it("asks for no spire model in a game with no spire until its end nears, then loads it once", async () => {
    loadAsync.mockClear();
    const projection = { getTiles: () => [tile(1, TileOccupier.None)], subscribeTiles: () => () => {} };
    const manager = new SpireManager(new Scene(), projection as never, new Group());
    await manager.prepare();
    manager.advanceGameEnd(endgameFrame(null), 0.016, new PerspectiveCamera(), null);
    expect(loadAsync).not.toHaveBeenCalled();

    manager.prepareGameEnd();
    manager.prepareGameEnd();
    await manager.prepare();
    expect(loadAsync).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it("loads the veil's model when the game has ended, opened late or before its end neared", async () => {
    loadAsync.mockClear();
    const projection = { getTiles: () => [], subscribeTiles: () => () => {} };
    const manager = new SpireManager(new Scene(), projection as never, new Group());
    manager.advanceGameEnd(endgameFrame(9), 0, new PerspectiveCamera(), null);
    await manager.prepare();
    expect(loadAsync).toHaveBeenCalledOnce();
    manager.destroy();
  });
});
