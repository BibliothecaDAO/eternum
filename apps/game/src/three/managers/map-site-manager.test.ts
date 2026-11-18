import { Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

const { load, models, mode, foundations, beasts, beastTroops, openings, clock, publish } = vi.hoisted(() => ({
  mode: { id: "frontier" },
  load: vi.fn(),
  models: [] as Array<{ name: string; count: number; setCount: (count: number) => void }>,
  foundations: [] as Array<{ entityId: number; progress: number; completed: boolean }>,
  beasts: [] as Array<{ species: string; count: number; scales: number[]; idles: unknown[] }>,
  beastTroops: new Map<number, bigint>(),
  openings: new Map<number, unknown>(),
  clock: { tick: 0 as number | undefined },
  publish: vi.fn(),
}));
vi.mock("@/observability/map-selection", () => ({ publishMapSelection: publish }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  readDefaultTick: () => clock.tick,
}));
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  readDeepBeastTroops: (_store: unknown, _now: number, id: bigint) => beastTroops.get(Number(id)) ?? 0n,
  readDeepRingOpening: (_store: unknown, _now: number, id: bigint) => openings.get(Number(id)),
}));
vi.mock("../structures/frontier-model", async () => {
  const { Group } = await import("three");
  return {
    FrontierModel: class {
      group = new Group();
      count = 0;
      scales: number[] = [];
      idles: unknown[] = [];
      constructor(
        _gltf: unknown,
        _capacity: number,
        public species: string,
      ) {
        beasts.push(this);
      }
      getCount = () => this.count;
      setCount = (count: number) => void (this.count = count);
      setMatrixAt = (index: number, matrix: { elements: number[] }) => void (this.scales[index] = matrix.elements[0]);
      setIdleAt = (index: number, idle: unknown) => void (this.idles[index] = idle);
      removeInstance = () => {};
      needsUpdate = () => {};
      dispose = () => {};
    },
  };
});
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

import { DEEP_BEASTS, deepSites, MineKinds, TileOccupier } from "@bibliothecadao/types";
import { FRONTIER_BEASTS } from "../structures/frontier-beast";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { MapSiteManager } from "./map-site-manager";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";

const tile = (col: number, occupierType: number) => ({
  hexCoords: { col, row: 0, alt: false },
  occupierType,
  occupierId: col,
});

describe("the Deep's sites on the map", () => {
  it("draws each site by its kind: the archive a hyperstructure's bare foundation, the core a rift, the mine a fragment mine, the altar a Shrine", async () => {
    mode.id = "frontier";
    models.length = 0;
    foundations.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
    }));
    const tiles = deepSites.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(new Scene(), projection as never, store as never, plates as never);
    await vi.waitFor(() =>
      expect(models.map(({ name }) => name).toSorted()).toEqual(["Bane altar", "Essence core", "Ethereal mine"]),
    );
    expect(load).toHaveBeenCalledWith(MineKinds[1].model);
    expect(load).toHaveBeenCalledWith(MineKinds[2].model);
    expect(load).toHaveBeenCalledWith("/models/frontier/painted/shrine.glb");
    // Drawn again at each refresh, always the same bare foundation of entity 10.
    await vi.waitFor(() => expect(foundations.length).toBeGreaterThan(0));
    expect(new Set(foundations.map((each) => JSON.stringify(each)))).toEqual(
      new Set([JSON.stringify({ entityId: 10, progress: 0, completed: false })]),
    );
    manager.destroy();
  });

  it("stands each kind's beast alone on its site while it guards it, the altar's Basilisk on its own model, and gives the site its building back once armies hold it", async () => {
    mode.id = "frontier";
    models.length = 0;
    beasts.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
    }));
    beastTroops.clear();
    deepSites.forEach((_, index) => beastTroops.set(10 + index, 5_000n));
    const core = 10 + deepSites.findIndex(({ key }) => key === "core");
    const altar = 10 + deepSites.findIndex(({ key }) => key === "altar");
    beastTroops.set(core, 0n);
    const tiles = deepSites.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]?.id });
    const listeners: Array<(changes: unknown[]) => void> = [];
    const store = {
      get: (model: string, key: { entity_id: number }) =>
        model === "DeepSite" && site(key).kind !== undefined ? site(key) : undefined,
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: (listener: (changes: unknown[]) => void) => {
        listeners.push(listener);
        return () => {};
      },
    };
    const manager = new MapSiteManager(new Scene(), projection as never, store as never, plates as never);
    await vi.waitFor(() =>
      expect(beasts.map(({ species }) => species).toSorted()).toEqual(["basilisk", "troll", "troll"]),
    );
    expect(load).toHaveBeenCalledWith(FRONTIER_BEASTS.basilisk.path);
    expect(load).not.toHaveBeenCalledWith(FRONTIER_BEASTS["dark-fey"].path);
    const basilisk = beasts.find(({ species }) => species === "basilisk")!;
    expect(basilisk.count).toBe(1);
    expect(basilisk.scales[0]).toBeCloseTo(DEEP_BEASTS.altar.scale);
    expect(basilisk.idles[0]).toEqual(DEEP_BEASTS.altar.idle);
    expect(models.map(({ name }) => name)).toEqual(["Essence core"]);
    const altarPlate = plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === altar)![0];
    expect(altarPlate.position.y).toBeCloseTo(DEEP_BEASTS.altar.scale + PLATE_CLEARANCE);
    const published = publish.mock.lastCall![0];
    expect(published.drawnSites).toMatchObject({ "deep:altar": 1, "deep:core": 1 });
    expect(published.siteHexes).toMatchObject({ "deep:altar": { col: altar, row: 0 } });
    beastTroops.set(altar, 0n);
    for (const listener of listeners)
      listener([{ model: "Guard", key: "altar", current: { structure_id: BigInt(altar) } }]);
    expect(basilisk.count).toBe(0);
    await vi.waitFor(() => expect(models.map(({ name }) => name).toSorted()).toEqual(["Bane altar", "Essence core"]));
    manager.destroy();
  });

  it("pins a closed ring's site with a lock and says on its plate when it opens; an open one, or one whose entries are still arriving, keeps its kind's look", () => {
    mode.id = "frontier";
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
    }));
    beastTroops.clear();
    openings.clear();
    openings.set(10, { known: { open: false, realms: 30 } });
    openings.set(11, { known: { open: true, realms: 0 } });
    openings.set(12, { unknown: "INCOMPLETE_SNAPSHOT: DeepEntries" });
    const tiles = [10, 11, 12].map((col) => tile(col, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(new Scene(), projection as never, store as never, plates as never);
    const look = (entityId: number) => {
      const { icon, reward } = plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === entityId)![0].plate;
      return { icon, reward };
    };
    expect(look(10)).toEqual({ icon: "lock", reward: "Opens at 30 Realms today" });
    expect(look(11)).toEqual({ icon: DEEP_SITE_FACES.core.icon, reward: undefined });
    expect(look(12)).toEqual({ icon: DEEP_SITE_FACES.mine.icon, reward: undefined });
    manager.destroy();
  });

  it("draws every site's building with its kind's look, and no beast, while chain time is not known yet", async () => {
    mode.id = "frontier";
    models.length = 0;
    beasts.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
    }));
    clock.tick = undefined;
    beastTroops.clear();
    openings.clear();
    deepSites.forEach((_, index) => {
      beastTroops.set(10 + index, 5_000n);
      openings.set(10 + index, { known: { open: false, realms: 30 } });
    });
    const tiles = deepSites.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(new Scene(), projection as never, store as never, plates as never);
    await vi.waitFor(() =>
      expect(models.map(({ name }) => name).toSorted()).toEqual(["Bane altar", "Essence core", "Ethereal mine"]),
    );
    expect(beasts).toEqual([]);
    expect(plates.setLabel.mock.calls.map(([plate]) => plate.plate.icon)).not.toContain("lock");
    clock.tick = 0;
    manager.destroy();
  });
});
