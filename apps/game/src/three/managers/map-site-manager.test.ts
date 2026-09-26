import { Scene } from "three";
import { describe, expect, it, vi } from "vitest";

const { load, models } = vi.hoisted(() => ({
  load: vi.fn(async (path: string) => ({ path })),
  models: [] as Array<{ name: string; count: number; setCount: (count: number) => void }>,
}));
vi.mock("../utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/utils")>()),
  gltfLoader: { loadAsync: load },
}));
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("@/three/managers/instanced-model", () => ({
  default: class {
    group = { visible: true };
    count = 0;
    constructor(
      _gltf: unknown,
      _capacity: number,
      _raycast: boolean,
      public name: string,
    ) {
      models.push(this);
    }
    getCount = () => this.count;
    setCount = (count: number) => void (this.count = count);
    setMatrixAt = () => {};
    removeInstance = () => {};
    needsUpdate = () => {};
    dispose = () => {};
  },
}));

import { MapSiteManager } from "./map-site-manager";

const tile = (col: number, occupierType: number) => ({ hexCoords: { col, row: 0, alt: false }, occupierType });

describe("Frontier's map sites", () => {
  it("draws each Shrine and Well where its tile stands, loads a kind only once seen, and drops a used one", async () => {
    let tiles = [tile(1, 40), tile(2, 40), tile(3, 1)];
    let listener!: (changes: unknown[]) => void;
    const projection = {
      getTiles: () => tiles,
      subscribeTiles: (next: typeof listener) => ((listener = next), () => {}),
    };
    const manager = new MapSiteManager(new Scene(), projection as never);
    await vi.waitFor(() => expect(models.map(({ name }) => name)).toEqual(["Shrine"]));
    expect(load).toHaveBeenCalledWith("/models/frontier/shrine.glb");
    expect(load).not.toHaveBeenCalledWith("/models/frontier/well.glb");
    expect(models[0].count).toBe(2);

    // Using a Shrine consumes its occupancy; a Well is found.
    const used = tiles[0];
    tiles = [tiles[1], tile(4, 41)];
    listener([{ previous: used, current: { ...used, occupierType: 0 } }, { current: tiles[1] }]);
    await vi.waitFor(() => expect(models.map(({ name }) => name)).toEqual(["Shrine", "Well"]));
    expect(models[0].count).toBe(1);
    expect(models[1].count).toBe(1);
    manager.destroy();
  });
});
