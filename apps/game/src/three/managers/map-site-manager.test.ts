import { Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

const { load, models, mode, beasts, beastTroops, openings, clock, publish, viewer } = vi.hoisted(() => ({
  mode: { id: "frontier" },
  load: vi.fn(),
  models: [] as Array<{ name: string; scene: string; count: number; setCount: (count: number) => void }>,
  beasts: [] as Array<{ species: string; count: number; scales: number[]; idles: unknown[] }>,
  beastTroops: new Map<number, bigint>(),
  openings: new Map<number, unknown>(),
  clock: { tick: 0 as number | undefined, day: 86_400 },
  publish: vi.fn(),
  viewer: { address: 0x111n as bigint | undefined },
}));
vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => viewer.address }));
vi.mock("@/observability/map-selection", () => ({ publishMapSelection: publish }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  readDefaultTick: () => clock.tick,
  readExpeditionRules: () => ({ dayUnitSeconds: clock.day }),
  dayOf: (_calendar: unknown, timestamp: number) => ({ index: Math.floor(timestamp / clock.day) }),
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
    scene: string;
    constructor(
      gltf: { scene: { name: string } },
      _capacity: number,
      _raycast: boolean,
      public name: string,
    ) {
      this.scene = gltf.scene.name;
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

import { aspects, DEEP_BEASTS, deepSites, ordersOfAspect, TileOccupier } from "@bibliothecadao/types";
import { deepGateTiles } from "@bibliothecadao/eternum/game-client";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { FRONTIER_BEASTS } from "../structures/frontier-beast";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { MapSiteManager } from "./map-site-manager";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";

const noGates = () => ({
  setLabel: vi.fn(),
  retainOnly: vi.fn(),
  dispose: vi.fn(),
  setHover: vi.fn(),
  clearHover: vi.fn(),
});

const tile = (col: number, occupierType: number) => ({
  hexCoords: { col, row: 0, alt: false },
  occupierType,
  occupierId: col,
});

describe("the Deep's sites on the map", () => {
  it("draws each site kind as its own landmark, once per site, from no model file", async () => {
    mode.id = "frontier";
    models.length = 0;
    load.mockReset();
    const tiles = deepSites.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(
      new Scene(),
      projection as never,
      store as never,
      plates as never,
      noGates() as never,
    );
    await vi.waitFor(() => expect(models.map(({ name }) => name).toSorted()).toEqual(ALL_KIND_NAMES));
    expect(models.map(({ count }) => count)).toEqual([1, 1, 1, 1]);
    expect(load).not.toHaveBeenCalled();
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
    const manager = new MapSiteManager(
      new Scene(),
      projection as never,
      store as never,
      plates as never,
      noGates() as never,
    );
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

  it("pins a closed ring's site with a lock, draws its landmark dormant and says on its plate when it opens; an open one, or one whose entries are still arriving, keeps its kind's look", async () => {
    mode.id = "frontier";
    models.length = 0;
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
    const manager = new MapSiteManager(
      new Scene(),
      projection as never,
      store as never,
      plates as never,
      noGates() as never,
    );
    const look = (entityId: number) => {
      const { icon, reward } = plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === entityId)![0].plate;
      return { icon, reward };
    };
    expect(look(10)).toEqual({ icon: "lock", reward: "Opens at 30 Realms today" });
    expect(look(11)).toEqual({ icon: DEEP_SITE_FACES.core.icon, reward: undefined });
    expect(look(12)).toEqual({ icon: DEEP_SITE_FACES.mine.icon, reward: undefined });
    await vi.waitFor(() =>
      expect(drawnScenes()).toEqual(["deep-landmark-core", "deep-landmark-foundation-dormant", "deep-landmark-mine"]),
    );
    manager.destroy();
  });

  it("draws every site's building with its kind's look, and no beast, while chain time is not known yet, then each open site's guarding beast and a closed ring's site dormant, its building under a lock, once a head binds it", async () => {
    const core = 10 + deepSites.findIndex(({ key }) => key === "core");
    const { manager, plates } = guardedSites(undefined, [], ["core"]);
    await vi.waitFor(() => expect(models.map(({ name }) => name).toSorted()).toEqual(ALL_KIND_NAMES));
    expect(beasts).toEqual([]);
    expect(plates.setLabel.mock.calls.map(([plate]) => plate.plate.icon)).not.toContain("lock");
    headAt(100);
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["basilisk", "troll", "troll"]));
    await vi.waitFor(() => expect(drawnScenes()).toEqual(["deep-landmark-core-dormant"]));
    expect(plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === core)![0].plate.icon).toBe("lock");
    manager.destroy();
  });

  it("stands a beast beaten yesterday back on its site when the day turns, with no site fact arriving", async () => {
    const altar = 10 + deepSites.findIndex(({ key }) => key === "altar");
    const { manager } = guardedSites(100, ["altar"]);
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["dark-fey", "troll", "troll"]));
    beastTroops.set(altar, 5_000n);
    headAt(clock.day + 100);
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["basilisk", "dark-fey", "troll", "troll"]));
    manager.destroy();
    clock.tick = 0;
  });

  it("draws each Aspect's gate on its tile as a portal wearing its first Order's crest, named from the catalog, the viewer's own gate in their colour", () => {
    mode.id = "frontier";
    clock.tick = 0;
    viewer.address = 0x111n;
    const projection = { getTiles: () => [], subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const gates = noGates();
    const store = {
      get: (model: string, key: { home?: bigint }) =>
        model === "DeepRules"
          ? { gate_distance: 4 }
          : model === "HomeAspect" && key.home === 9n
            ? { aspect: 2 }
            : undefined,
      require: (model: string) => (model === "SettlementRules" ? { spacing: 1024 } : undefined),
      structuresOwnedBy: (_game: number, owner: bigint) => (owner === 0x111n ? [{ entity_id: 9n }] : []),
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(
      new Scene(),
      projection as never,
      store as never,
      plates as never,
      gates as never,
    );
    const drawn = gates.setLabel.mock.calls.map(([{ entityId, plate }]) => [
      entityId,
      plate.name,
      plate.icon,
      plate.crest,
      plate.relation,
    ]);
    expect(drawn).toEqual(
      aspects.map(({ id, name }) => [id, name, "portal", ordersOfAspect(id)[0]!.orderId, id === 2 ? "own" : "neutral"]),
    );
    const [north] = deepGateTiles(4, 1024);
    manager.hover({ col: north!.col, row: north!.row });
    expect(gates.setHover).toHaveBeenLastCalledWith(north!.aspect);
    manager.hover({ col: 0, row: 0 });
    expect(gates.clearHover).toHaveBeenCalled();
    manager.destroy();
  });
});

function guardedSites(tick: number | undefined, beaten: string[] = [], closed: string[] = []) {
  mode.id = "frontier";
  models.length = 0;
  beasts.length = 0;
  load.mockReset();
  load.mockImplementation(async (path: string) => ({
    path,
    scene: new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial()),
  }));
  clock.tick = tick;
  beastTroops.clear();
  openings.clear();
  deepSites.forEach(({ key }, index) => {
    beastTroops.set(10 + index, beaten.includes(key) ? 0n : 5_000n);
    openings.set(10 + index, { known: { open: !closed.includes(key), realms: 30 } });
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
  return {
    manager: new MapSiteManager(new Scene(), projection as never, store as never, plates as never, noGates() as never),
    plates,
  };
}

function headAt(tick: number) {
  clock.tick = tick;
  useChainTimeStore.setState({ executionFloorMs: tick * 1000 });
}

const ALL_KIND_NAMES = deepSites.map(({ name }) => name).toSorted();

const drawnScenes = () =>
  models
    .filter(({ count }) => count > 0)
    .map(({ scene }) => scene)
    .toSorted();

const standingBeasts = () =>
  beasts
    .filter(({ count }) => count > 0)
    .map(({ species }) => species)
    .toSorted();
