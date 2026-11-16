import { Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

const { load, models, mode, foundations } = vi.hoisted(() => ({
  mode: { id: "frontier" },
  load: vi.fn(),
  models: [] as Array<{ name: string; count: number; setCount: (count: number) => void }>,
  foundations: [] as Array<{ entityId: number; progress: number; completed: boolean }>,
}));
vi.mock("@/config/game-modes", () => ({ getGameModeConfig: () => mode }));
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
    group = new Group();
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

vi.mock("../structures/hyperstructure-model", async () => {
  const { Group } = await import("three");
  return {
    HyperstructureModel: class {
      group = new Group();
      count = 0;
      getCount = () => this.count;
      setCount = (count: number) => void (this.count = count);
      setMatrixAt = () => {};
      setConstructionAt = (_index: number, construction: (typeof foundations)[number]) =>
        void foundations.push(construction);
      removeInstance = () => {};
      needsUpdate = () => {};
      dispose = () => {};
    },
  };
});

import { deepSites, MineKinds, TileOccupier } from "@bibliothecadao/types";
import { MapSiteManager } from "./map-site-manager";

const tile = (col: number, occupierType: number) => ({
  hexCoords: { col, row: 0, alt: false },
  occupierType,
  occupierId: col,
});

describe("the Deep's sites on the map", () => {
  it("draws each site by its kind: the Foundation a hyperstructure's bare foundation, the Quarry a fragment mine, the Altar a Shrine", async () => {
    mode.id = "frontier";
    models.length = 0;
    foundations.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
    }));
    // Entities 10, 11 and 12 are the Foundation, the Quarry and the Altar, by their DeepSite rows.
    const tiles = [tile(10, TileOccupier.DeepSite), tile(11, TileOccupier.DeepSite), tile(12, TileOccupier.DeepSite)];
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(new Scene(), projection as never, store as never, plates as never);
    await vi.waitFor(() => expect(models.map(({ name }) => name).toSorted()).toEqual(["Altar", "Quarry"]));
    expect(load).toHaveBeenCalledWith(MineKinds[2].model);
    expect(load).toHaveBeenCalledWith("/models/frontier/painted/shrine.glb");
    // Drawn again at each refresh, always the same bare foundation of entity 10.
    await vi.waitFor(() => expect(foundations.length).toBeGreaterThan(0));
    expect(new Set(foundations.map((each) => JSON.stringify(each)))).toEqual(
      new Set([JSON.stringify({ entityId: 10, progress: 0, completed: false })]),
    );
    manager.destroy();
  });
});
