// @vitest-environment jsdom
import { TileOccupier } from "@bibliothecadao/types";
import { Group, Scene } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { describe, expect, it, vi } from "vitest";

const { placed } = vi.hoisted(() => ({ placed: [] as boolean[] }));
vi.mock("../utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/utils")>()),
  gltfLoader: { loadAsync: async () => ({}) },
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
    placeSpire = (_index: number, _matrix: unknown, dormant: boolean) => void placed.push(dormant);
    setCount = () => {};
    needsUpdate = () => {};
    dispose = () => {};
    updateAnimations = () => {};
  },
}));

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
    await vi.waitFor(() => expect(placed).toEqual([false, true]));
    const names = labels.children.map((label) => (label as CSS2DObject).element.textContent);
    expect(names).toEqual(["Spire"]);
    manager.destroy();
  });
});
