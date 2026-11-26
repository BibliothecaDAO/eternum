import { Scene, Group, ImageLoader, InstancedMesh, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

const { load, models, mode, beasts, beastTroops, openings, clock, publish, viewer } = vi.hoisted(() => ({
  mode: { id: "frontier" },
  load: vi.fn(),
  models: [] as Array<{ name: string; scene: string; count: number; setCount: (count: number) => void }>,
  beasts: [] as Array<{ species: string; count: number; scales: number[]; layers: number[] }>,
  beastTroops: new Map<number, bigint>(),
  openings: new Map<number, unknown>(),
  clock: { tick: 0 as number | undefined, day: 86_400 },
  publish: vi.fn(),
  viewer: { address: 0x111n as bigint | undefined },
}));
vi.mock("@/hooks/store/use-account-store", () => ({
  accountAddress: () => viewer.address,
  useAccountStore: { getState: () => ({ account: viewer.address === undefined ? null : { address: viewer.address } }) },
}));
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
      layers: number[] = [];
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
      setLayerAt = (index: number, layer: number) => void (this.layers[index] = layer);
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

import { SEAT_COLOURS, SIDE_HEX, seatSide } from "@/tokens";
import { setActiveGame } from "@/runtime/world";
import { setOpenGameSeats } from "@/utils/entity-ownership";
import { overrideSpectateIntent } from "@/utils/spectator-session";
import {
  aspectName,
  aspects,
  beastModel,
  DEEP_BEASTS,
  deepSites,
  ordersOfAspect,
  RESOURCE_PRECISION,
  TileOccupier,
} from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { deepGateTiles, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { DeepLandmarkModel } from "../structures/deep-landmarks";
import { ORDER_STANDARD_NAME, resolveOrderSignumCell } from "../structures/order-standard";
import { FRONTIER_BEASTS } from "../structures/frontier-beast";
import { DEEP_SITE_MODELS } from "../structures/deep-landmarks";
import { DEEP_SITE_FACES, deepSitePlatePay } from "@/ui/features/frontier/deep/deep-site-faces";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { DEEP_WORDS, ownerAndAspect } from "@/ui/design-system/kit/words";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";
import { MapSiteManager } from "./map-site-manager";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
  it("draws each site kind from its own landmark model, once per site", async () => {
    mode.id = "frontier";
    models.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 1.4, 1), new MeshBasicMaterial()),
    }));
    const tiles = deepSites.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const site = (key: { entity_id: number }) => ({ kind: deepSites[key.entity_id - 10]!.id });
    const store = {
      get: (model: string, key: { entity_id: number }) => (model === "DeepSite" ? site(key) : undefined),
      require: (_model: string, key: { entity_id: number }) => site(key),
      inGame: () => [],
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
    expect(load.mock.calls.map(([path]) => path).toSorted()).toEqual(Object.values(DEEP_SITE_MODELS).toSorted());
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
      inGame: () => [],
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
      expect(beasts.map(({ species }) => species).toSorted()).toEqual(["balrog", "basilisk", "colossus"]),
    );
    expect(load).toHaveBeenCalledWith(FRONTIER_BEASTS.basilisk.path);
    expect(load).not.toHaveBeenCalledWith(FRONTIER_BEASTS.warlock.path);
    const basilisk = beasts.find(({ species }) => species === "basilisk")!;
    expect(basilisk.count).toBe(1);
    expect(basilisk.scales[0]).toBeCloseTo(DEEP_BEASTS.altar.scale);
    expect(basilisk.layers[0]).toBe(3);
    expect(models.map(({ name }) => name)).toEqual(["Essence core"]);
    const altarPlate = plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === altar)![0];
    expect(altarPlate.position.y).toBeCloseTo(DEEP_BEASTS.altar.scale + PLATE_CLEARANCE);
    const published = publish.mock.lastCall![0];
    expect(published.drawnSites).toMatchObject({ "deep:altar": 1, "deep:core": 1 });
    expect(published.siteHexes).toMatchObject({ "deep:altar": { col: altar, row: 0, entity: altar } });
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
      inGame: () => [],
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
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["balrog", "basilisk", "colossus"]));
    await vi.waitFor(() => expect(drawnScenes()).toEqual(["deep-landmark-core-dormant"]));
    expect(plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === core)![0].plate.icon).toBe("lock");
    manager.destroy();
  });

  it("stands a beast beaten yesterday back on its site when the day turns, with no site fact arriving", async () => {
    const altar = 10 + deepSites.findIndex(({ key }) => key === "altar");
    const { manager } = guardedSites(100, ["altar"]);
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["balrog", "colossus", "warlock"]));
    beastTroops.set(altar, 5_000n);
    headAt(clock.day + 100);
    await vi.waitFor(() => expect(standingBeasts()).toEqual(["balrog", "basilisk", "colossus", "warlock"]));
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
          ? { gate_distance: 4, rings: [{ radius: 5, realms: 0 }] }
          : model === "SliceRules"
            ? { day_unit_seconds: clock.day, tick_config: { armies_tick_in_seconds: 60n } }
            : model === "SettlementRules"
              ? { spacing: 1024 }
              : model === "GameRegistry"
                ? {
                    start_main_at: 10n,
                    scheduled_end_at: BigInt(clock.day * 5),
                    end_at: BigInt(clock.day * 5),
                    seed: 1n,
                  }
                : model === "HomeAspect" && key.home === 9n
                  ? { aspect: 2 }
                  : undefined,
      require: (model: string) => (model === "SettlementRules" ? { spacing: 1024 } : undefined),
      inGame: () => [],
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

  it("colours and labels each claimed Deep site by its owner's side, its garrison in slot order or undefended once drained, its beast while unclaimed, and re-places guard standards as garrisons drain", async () => {
    mode.id = "frontier";
    models.length = 0;
    load.mockReset();
    load.mockImplementation(async (path: string) => ({
      path,
      scene: new Mesh(new BoxGeometry(1, 1.4, 1), new MeshBasicMaterial()),
    }));
    beastTroops.clear();
    openings.clear();
    clock.tick = 100;
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    vi.spyOn(ImageLoader.prototype, "loadAsync").mockResolvedValue({ width: 256, height: 256 } as HTMLImageElement);
    const heldSpy = vi.spyOn(DeepLandmarkModel.prototype, "setHolderColorAt");
    const gameId = configManager.getActiveGameId();
    const precision = BigInt(RESOURCE_PRECISION);
    const [firstOrder, secondOrder] = ordersOfAspect(2);
    const [rivalOrder] = ordersOfAspect(3);
    const ringKinds = Array.from(
      { length: nativeRuleConstants.DEEP_RING_SITES },
      (_, index) => deepSites[index % deepSites.length]!,
    );
    const tiles = ringKinds.map((_, index) => tile(10 + index, TileOccupier.DeepSite));
    const altarSite = 10 + ringKinds.findIndex(({ key }) => key === "altar");
    beastTroops.set(altarSite, 5_000n * precision);
    const projection = { getTiles: () => tiles, subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const rows: Record<string, Record<string, unknown>[]> = {
      SliceRules: [
        {
          game_id: gameId,
          day_unit_seconds: clock.day,
          tick_config: { armies_tick_in_seconds: 60n },
          capacity_config: { troop_capacity: 10 },
        },
      ],
      SettlementRules: [{ game_id: gameId, spacing: 1024 }],
      GameRegistry: [
        {
          game_id: gameId,
          start_main_at: 0n,
          scheduled_end_at: BigInt(clock.day * 5),
          end_at: BigInt(clock.day * 5),
          seed: 1n,
        },
      ],
      DeepRules: [
        {
          game_id: gameId,
          gate_distance: 4,
          loss_per_tick: 500n * precision,
          rings: [{ radius: 5, realms: 0 }],
          beasts: deepSites.map((_, index) => ({ count: 5_000n * precision, bow: index % 2 === 1 })),
          building_pay: { alone: 6, pair: 3, crowd: 2 },
        },
      ],
      DeepEntries: [{ game_id: gameId, day: 0n, count: 10 }],
      RaceRules: [{ game_id: gameId }],
      BaneRules: [{ game_id: gameId }],
      DeepSite: ringKinds.map((kind, index) => ({
        game_id: gameId,
        entity_id: BigInt(10 + index),
        kind: kind.id,
        ring: 0,
        day: 0n,
        aspect: [2, 3, 2][index] ?? 0,
      })),
      Guard: [
        ...ringKinds.map((_, index) => ({
          game_id: gameId,
          structure_id: BigInt(10 + index),
          slot: 0,
          troops:
            10 + index === altarSite
              ? { category: "Crossbowman", count: 5_000n * precision }
              : { count: [1_000n * precision, 500n * precision][index] ?? 0n },
        })),
        { game_id: gameId, structure_id: 10n, slot: 1, troops: { count: 500n * precision } },
      ],
      TileOccupancy: ringKinds.map((_, index) => ({
        game_id: gameId,
        entity_id: BigInt(10 + index),
        col: 10 + index,
        row: 0,
        alt: false,
      })),
      DeepTick: [{ game_id: gameId, paid_tick: 1n }],
      GarrisonSlot: [
        { game_id: gameId, structure_id: 10n, slot: 0, home: 9n },
        { game_id: gameId, structure_id: 10n, slot: 1, home: 19n },
        { game_id: gameId, structure_id: 11n, slot: 0, home: 29n },
      ],
      HomeAspect: [
        { game_id: gameId, home: 9n, aspect: 2 },
        { game_id: gameId, home: 19n, aspect: 2 },
        { game_id: gameId, home: 29n, aspect: 3 },
      ],
      Structure: [
        { game_id: gameId, entity_id: 9n, owner: 0x111n, metadata: { order: firstOrder!.orderId } },
        { game_id: gameId, entity_id: 19n, owner: 0x222n, metadata: { order: secondOrder!.orderId } },
        { game_id: gameId, entity_id: 29n, owner: 0x333n, metadata: { order: rivalOrder!.orderId } },
        { game_id: gameId, entity_id: 10n, owner: 0x222n, metadata: { order: 0 } },
        { game_id: gameId, entity_id: 11n, owner: 0x333n, metadata: { order: 0 } },
        { game_id: gameId, entity_id: 12n, owner: 0x111n, metadata: { order: 0 } },
      ],
    };
    const matchKey = (row: Record<string, unknown>, key: Record<string, unknown>) =>
      Object.entries(key).every(([field, value]) => String(row[field]) === String(value));
    const get = (model: string, key: Record<string, unknown>) => rows[model]?.find((row) => matchKey(row, key));
    const store = {
      get,
      require: (model: string, key: Record<string, unknown>) => {
        const row = get(model, key);
        if (!row) throw new Error(`missing ${model}`);
        return row;
      },
      requireOrAbsent: (model: string, key: Record<string, unknown>) => ({ known: get(model, key) ?? null }),
      absenceKnown: () => ({ known: true }),
      entityOccupancy: (game_id: number, entity_id: bigint) => get("TileOccupancy", { game_id, entity_id }),
      inGame: (model: string) => rows[model] ?? [],
      structuresOwnedBy: (_gameId: number, owner: bigint) =>
        (rows.Structure ?? []).filter((row) => row.owner === owner),
      subscribe: () => () => {},
    };
    const scene = new Scene();
    const manager = new MapSiteManager(scene, projection as never, store as never, plates as never, noGates() as never);
    await vi.waitFor(() => {
      expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.ally);
      expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.enemy);
      expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.own);
    });
    const plateOf = (entityId: number) =>
      plates.setLabel.mock.calls.findLast(([plate]) => plate.entityId === entityId)![0].plate;
    const claimed = (entityId: number) => {
      const plate = plateOf(entityId);
      return [plate.relation, plate.named, plate.owner, plate.name, plate.crest, plate.guards];
    };
    const knights = (count: number) => ({ type: "knight", tier: null, count });
    expect(claimed(10)).toEqual([
      "ally",
      true,
      ownerAndAspect(getPlayerDisplayName(0x222n), aspectName(2)),
      ringKinds[0]!.name,
      secondOrder!.orderId,
      [knights(1_000), knights(500)],
    ]);
    expect(claimed(11)).toEqual([
      "enemy",
      true,
      ownerAndAspect(getPlayerDisplayName(0x333n), aspectName(3)),
      ringKinds[1]!.name,
      rivalOrder!.orderId,
      [knights(500)],
    ]);
    expect(claimed(12)).toEqual([
      "own",
      true,
      ownerAndAspect(getPlayerDisplayName(0x111n), aspectName(2)),
      ringKinds[2]!.name,
      firstOrder!.orderId,
      [],
    ]);
    const altar = plateOf(altarSite);
    const basilisk = beastModel(DEEP_BEASTS.altar);
    expect([altar.relation, altar.named, altar.beast, altar.place, altar.icon, altar.reward, altar.guards]).toEqual([
      "neutral",
      false,
      undefined,
      ringKinds.find(({ key }) => key === "altar")!.name,
      beastMeaning(basilisk),
      DEEP_WORDS.altarPlate,
      [{ type: "crossbowman", tier: null, count: 5_000, beast: basilisk }],
    ]);
    expect(
      deepSitePlatePay(store as never, gameId, { kind: nativeRuleConstants.DEEP_FOUNDATION, buildingPay: 3 }),
    ).toBe(DEEP_WORDS.foundationPlate(3));
    rows.BaneRules = [];
    rows.RaceRules = [];
    expect(
      deepSitePlatePay(store as never, gameId, { kind: nativeRuleConstants.DEEP_FOUNDATION, buildingPay: 3 }),
    ).toBeUndefined();
    const noRulesManager = new MapSiteManager(
      new Scene(),
      projection as never,
      store as never,
      plates as never,
      noGates() as never,
    );
    expect(plateOf(altarSite).reward).toBeUndefined();
    noRulesManager.destroy();
    rows.BaneRules = [{ game_id: gameId }];
    rows.RaceRules = [{ game_id: gameId }];
    heldSpy.mockClear();
    const watchedGame = { chainId: "WATCH_TEST", gameId, name: "WATCH_TEST" };
    setActiveGame(watchedGame);
    overrideSpectateIntent(true);
    setOpenGameSeats(watchedGame, [0x333n, 0x222n]);
    try {
      expect(heldSpy).toHaveBeenCalledWith(0, SEAT_COLOURS[0]);
      expect(heldSpy).toHaveBeenCalledWith(0, SEAT_COLOURS[1]);
      expect([plateOf(11).relation, plateOf(11).watched?.colour]).toEqual(["neutral", SEAT_COLOURS[0]]);
      expect([plateOf(altarSite).relation, plateOf(altarSite).watched?.colour]).toEqual([
        "neutral",
        seatSide(null).colour,
      ]);
    } finally {
      setOpenGameSeats(watchedGame, []);
      overrideSpectateIntent(false);
    }
    const signum = scene.getObjectByName(ORDER_STANDARD_NAME)!;
    const emblem = signum.getObjectByName("Order signum emblem") as InstancedMesh;
    const cell = emblem.geometry.getAttribute("signumOrderCell");
    expect(emblem.count).toBe(3);
    expect([cell.getX(0), cell.getX(1), cell.getX(2)]).toEqual([
      resolveOrderSignumCell(secondOrder!.orderId),
      resolveOrderSignumCell(firstOrder!.orderId),
      resolveOrderSignumCell(rivalOrder!.orderId),
    ]);

    heldSpy.mockClear();
    headAt(120);
    expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.ally);
    expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.enemy);
    expect(emblem.count).toBe(1);
    expect(cell.getX(0)).toBe(resolveOrderSignumCell(firstOrder!.orderId));

    heldSpy.mockClear();
    headAt(180);
    expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.ally);
    expect(heldSpy).toHaveBeenCalledWith(0, SIDE_HEX.enemy);
    expect([plateOf(10).guards, plateOf(11).guards]).toEqual([[], []]);
    expect(emblem.count).toBe(0);

    manager.destroy();
    clock.tick = 0;
  });

  it("throws loudly on missing Deep config and waits quietly while Deep sync is incomplete", () => {
    mode.id = "frontier";
    clock.tick = 100;
    const gameId = configManager.getActiveGameId();
    const projection = { getTiles: () => [], subscribeTiles: () => () => {} };
    const plates = { setLabel: vi.fn(), retainOnly: vi.fn(), dispose: vi.fn(), setHover: vi.fn(), clearHover: vi.fn() };
    const missingRulesStore = {
      get: () => undefined,
      require: () => {
        throw new Error("unexpected");
      },
      inGame: (model: string) =>
        model === "DeepSite" ? [{ game_id: gameId, entity_id: 10n, kind: 0, ring: 0, day: 0n }] : [],
      subscribe: () => () => {},
    };
    expect(
      () =>
        new MapSiteManager(
          new Scene(),
          projection as never,
          missingRulesStore as never,
          plates as never,
          noGates() as never,
        ),
    ).toThrow("Deep sites are missing their preset rules");

    const missingCalendarStore = {
      get: (model: string) =>
        model === "DeepRules" ? { game_id: gameId, gate_distance: 4, rings: [{ radius: 5, realms: 0 }] } : undefined,
      require: (model: string) => (model === "SettlementRules" ? { spacing: 1024 } : undefined),
      inGame: () => [],
      structuresOwnedBy: () => [],
      subscribe: () => () => {},
    };
    expect(
      () =>
        new MapSiteManager(
          new Scene(),
          projection as never,
          missingCalendarStore as never,
          plates as never,
          noGates() as never,
        ),
    ).toThrow("Deep sites require expedition rules");

    const incompleteSyncStore = {
      get: (model: string) =>
        model === "DeepRules"
          ? { game_id: gameId, gate_distance: 4, rings: [{ radius: 5, realms: 0 }] }
          : model === "SliceRules"
            ? { game_id: gameId, day_unit_seconds: clock.day, tick_config: { armies_tick_in_seconds: 60n } }
            : model === "SettlementRules"
              ? { game_id: gameId, spacing: 1024 }
              : model === "GameRegistry"
                ? {
                    game_id: gameId,
                    start_main_at: 0n,
                    scheduled_end_at: BigInt(clock.day * 5),
                    end_at: BigInt(clock.day * 5),
                    seed: 1n,
                  }
                : undefined,
      require: (model: string) => (model === "SettlementRules" ? { spacing: 1024 } : undefined),
      inGame: (model: string) =>
        model === "DeepSite" ? [{ game_id: gameId, entity_id: 10n, kind: 0, ring: 0, day: 0n }] : [],
      structuresOwnedBy: () => [],
      subscribe: () => () => {},
    };
    const manager = new MapSiteManager(
      new Scene(),
      projection as never,
      incompleteSyncStore as never,
      plates as never,
      noGates() as never,
    );
    manager.destroy();
    clock.tick = 0;
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
    inGame: () => [],
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
