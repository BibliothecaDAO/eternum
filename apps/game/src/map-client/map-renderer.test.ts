import { configManager } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BiomeIdToType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Hex } from "./land-from-facts";

interface Tile extends Hex {
  biome: number;
  occupied: boolean;
}
interface Structure {
  entityId: number;
  occupierType: number;
  hex: Hex;
}
type Listener = (changes: Hex[]) => void;

const world = vi.hoisted(() => ({
  tiles: [] as Tile[],
  structures: [] as Structure[],
  landmarks: [] as Array<{ hex: Hex; path: string }>,
  listeners: new Map<string, Listener>(),
  scene: null as "map" | "hex" | null,
  bootToken: 1,
  loadArt: vi.fn(),
  pack: vi.fn(),
  start: vi.fn(),
  native: { free: vi.fn(), set_troop: vi.fn(), show_order: vi.fn(), render: vi.fn(), resize: vi.fn() },
  worldmapReady: vi.fn(),
  worldmapConverged: vi.fn(),
  hexReady: vi.fn(),
  sceneFailed: vi.fn(),
  layerChanged: () => {},
  picked: (() => {}) as (picked: unknown) => void,
  plates: {
    structures: [] as Array<{ entityId: number; hex: Hex }>,
    armies: [] as Array<{ entityId: number; hex: Hex }>,
  },
  labels: {
    showStructures: vi.fn(),
    showArmies: vi.fn(),
    frame: vi.fn(),
    select: vi.fn(),
    hover: vi.fn(),
    dispose: vi.fn(),
  },
  inputs: vi.fn(),
  armies: [] as Array<{ entityId: number; at: { x: number; z: number }; build: string; tint: number[] }>,
  event: (() => {}) as (event: unknown) => void,
  placed: new Map<number, { hexCoords: Hex & { alt: boolean } }>(),
}));

const subscribe = (name: string) => (listener: Listener) => {
  world.listeners.set(name, listener);
  return () => world.listeners.delete(name);
};
const projection = {
  subscribeArmies: subscribe("armies"),
  subscribeTiles: subscribe("tiles"),
  subscribeStructures: subscribe("structures"),
  subscribeChests: subscribe("chests"),
  getStructure: (entityId: number) => world.placed.get(entityId),
};

vi.mock("@bibliothecadao/eternum/game-sync", () => ({
  requireActiveGameSyncRuntime: () => ({ requireWorldSpatialProjection: () => projection }),
}));
vi.mock("@/game-entry/play-route-readiness-store", () => ({
  getCurrentPlayRouteBootToken: () => world.bootToken,
  usePlayRouteReadinessStore: {
    getState: () => ({
      markWorldmapReady: world.worldmapReady,
      markSceneFailed: world.sceneFailed,
      markWorldmapConverged: world.worldmapConverged,
      markHexReady: world.hexReady,
    }),
  },
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({ setIsLoadingScreenEnabled: vi.fn(), setCameraTargetHex: vi.fn() }),
    subscribe: (pick: (state: object) => unknown, changed: (picked: unknown) => void) => {
      const what = pick({ mapLayer: "layer", mapSelection: "selection" }) as "layer" | "selection";
      if (what === "layer") world.layerChanged = () => changed(undefined);
      else world.picked = changed;
      return () => {};
    },
  },
}));
vi.mock("@/play/navigation/play-route", () => ({
  parsePlayRoute: () => (world.scene ? { scene: world.scene, col: null, row: null } : null),
}));
vi.mock("@/three/scenes/worldmap-camera-view", () => ({ forgetCameraView: vi.fn(), publishCameraView: vi.fn() }));
vi.mock("@/three/scenes/worldmap-map-selection", () => ({ bindMapSelection: () => () => {} }));
vi.mock("@/three/world-origin", () => ({
  setWorldOrigin: vi.fn(),
  worldHexAt: (x: number, z: number) => ({ col: x, row: z }),
  worldHexToWorld: (col: number, row: number) => ({ x: col, z: row }),
  worldOrigin: () => ({ col: 0, row: 0 }),
}));
vi.mock("./map-facts", () => ({
  changedHexes: (changes: Hex[]) => changes,
  contractHexOf: (hex: Hex) => hex,
  normalizedHexOf: (hex: Hex) => hex,
  readArmies: () => world.armies,
  readStructures: () => world.structures,
  readLandmarks: () => world.landmarks,
  readTiles: () => world.tiles,
}));
vi.mock("./plate-facts", () => ({
  readStructurePlates: () => world.plates.structures,
  readArmyPlates: () => world.plates.armies,
}));
vi.mock("./map-labels", () => ({
  MapLabels: class {
    constructor() {
      return world.labels;
    }
  },
}));
vi.mock("@/hooks/use-player-profile", () => ({ watchPlayerNames: () => () => {} }));
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("./map-art", () => ({ MapArt: { load: world.loadArt } }));
vi.mock("./map-input", () => ({
  MapInput: class {
    constructor() {
      world.inputs();
    }
    dispose() {}
  },
}));
vi.mock("./map-selection", () => ({
  MapSelection: class {
    showOrder() {}
    dispose() {}
  },
}));
vi.mock("./scene-from-land", () => ({ packLand: world.pack }));
vi.mock("./renderer/map_client", () => ({ default: async () => {}, MapRenderer: { start: world.start } }));

import { MapClientRenderer } from "./map-renderer";

const HERE: Hex = { col: 0, row: 0 };
const packed = (land: unknown, structures: unknown, landmarks?: unknown) => ({
  scene: { table: JSON.stringify({ land, structures, landmarks }), buffer: new Uint8Array() },
  groundAt: () => 0,
  tops: new Map<string, number>(),
});
/** What the renderer was last started on: the land and the structures packed for it. */
const drawn = () => JSON.parse(world.start.mock.calls.at(-1)![1] as string);
const publish = (name: "tiles" | "structures" | "chests" | "armies", changes: Hex[] = [HERE]) =>
  world.listeners.get(name)!(changes);
const offerWebGPU = () => Object.defineProperty(navigator, "gpu", { value: {}, configurable: true });

function newRenderer() {
  const store = {
    subscribeEvents: (listener: (event: unknown) => void) => {
      world.event = listener;
      return () => {};
    },
  };
  return new MapClientRenderer({ store } as unknown as GameClientSetup);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  world.tiles = [{ ...HERE, biome: 1, occupied: false }];
  world.structures = [];
  world.landmarks = [];
  world.plates = { structures: [], armies: [] };
  world.armies = [];
  world.placed.clear();
  world.listeners.clear();
  world.scene = null;
  world.bootToken = 1;
  world.loadArt.mockImplementation(async () => ({ dispose: vi.fn() }));
  world.pack.mockImplementation(async (_art, land, structures, landmarks) => packed(land, structures, landmarks));
  world.start.mockReset().mockResolvedValue(world.native);
});

afterEach(() => {
  vi.useRealTimers();
  document.getElementById("main-canvas")?.remove();
  Reflect.deleteProperty(navigator, "gpu");
  window.history.replaceState(null, "", "/");
});

describe("the land the map draws", () => {
  it("is built again when a tile's biome changes and the count of tiles does not", async () => {
    const renderer = newRenderer();
    await renderer.initScene();

    world.tiles = [{ ...world.tiles[0], biome: 2 }];
    publish("tiles");
    await vi.advanceTimersByTimeAsync(250);

    expect(drawn().land.cells[0].biome).toBe(BiomeIdToType[2]);
    renderer.destroy();
  });

  it("is built again when a structure moves and keeps its id and type", async () => {
    world.structures = [{ entityId: 12, occupierType: 1, hex: HERE }];
    const renderer = newRenderer();
    await renderer.initScene();

    world.structures = [{ ...world.structures[0], hex: { col: 1, row: 0 } }];
    publish("structures", [HERE, { col: 1, row: 0 }]);
    await vi.advanceTimersByTimeAsync(250);

    expect(drawn().structures[0].hex).toEqual({ col: 1, row: 0 });
    renderer.destroy();
  });

  it("shows the newest facts when another change is published while a land is being packed", async () => {
    const renderer = newRenderer();
    await renderer.initScene();
    let finishPacking!: () => void;
    world.pack.mockImplementationOnce(
      (_art, land, structures) => new Promise((done) => (finishPacking = () => done(packed(land, structures)))),
    );

    world.tiles.push({ col: 1, row: 0, biome: 1, occupied: false });
    publish("tiles");
    await vi.advanceTimersByTimeAsync(250);
    world.tiles.push({ col: 2, row: 0, biome: 1, occupied: false });
    publish("tiles");
    await vi.advanceTimersByTimeAsync(250);
    finishPacking();
    await vi.advanceTimersByTimeAsync(250);

    expect(drawn().land.cells.map((cell: Hex) => cell.col)).toEqual([0, 1, 2]);
    renderer.destroy();
  });

  it("shows a change published while the first land is being built", async () => {
    let finishPacking!: () => void;
    world.pack.mockImplementationOnce(
      (_art, land, structures) => new Promise((done) => (finishPacking = () => done(packed(land, structures)))),
    );
    const renderer = newRenderer();
    const starting = renderer.initScene();
    await vi.waitFor(() => expect(world.pack).toHaveBeenCalledOnce());

    world.tiles.push({ col: 1, row: 0, biome: 1, occupied: false });
    publish("tiles");
    finishPacking();
    await starting;

    expect(drawn().land.cells.map((cell: Hex) => cell.col)).toEqual([0, 1]);
    renderer.destroy();
  });

  it("is built once for changes published close together, and no later for the changes that keep coming", async () => {
    const renderer = newRenderer();
    await renderer.initScene();

    publish("tiles");
    await vi.advanceTimersByTimeAsync(150);
    publish("tiles");
    await vi.advanceTimersByTimeAsync(60);

    expect(world.pack).toHaveBeenCalledTimes(2);
    renderer.destroy();
  });

  it("is built again from the facts of another layer when the layer shown changes", async () => {
    const renderer = newRenderer();
    await renderer.initScene();

    // The facts reader now answers for the Ethereal: one tile, elsewhere.
    world.tiles = [{ col: 5, row: 0, biome: 1, occupied: false }];
    world.layerChanged();
    await vi.advanceTimersByTimeAsync(250);

    expect(drawn().land.cells.map((cell: Hex) => cell.col)).toEqual([5]);
    renderer.destroy();
  });

  it("holds the spires, sites and chests within its reach, and is built again when a chest comes or goes", async () => {
    world.landmarks = [
      { hex: HERE, path: "/models/ethereal/spire.glb" },
      { hex: { col: 500, row: 500 }, path: "/models/outposts/well.glb" },
    ];
    const renderer = newRenderer();
    await renderer.initScene();
    expect(drawn().landmarks).toEqual([{ hex: HERE, path: "/models/ethereal/spire.glb" }]);

    world.landmarks = [...world.landmarks, { hex: { col: 1, row: 0 }, path: "/models/reward-tiles/chest-c2.glb" }];
    publish("chests", [{ col: 1, row: 0 }]);
    await vi.advanceTimersByTimeAsync(250);

    expect(drawn().landmarks.map((landmark: { hex: Hex }) => landmark.hex.col)).toEqual([0, 1]);
    renderer.destroy();
  });

  it("is left as it is by a change far from it", async () => {
    const renderer = newRenderer();
    await renderer.initScene();

    publish("tiles", [{ col: 500, row: 500 }]);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(world.pack).toHaveBeenCalledTimes(1);
    renderer.destroy();
  });
});

describe("a map destroyed while it starts", () => {
  const expectNothingLeft = () => {
    expect(world.inputs).not.toHaveBeenCalled();
    expect([...world.listeners.keys()]).toEqual([]);
    expect(world.worldmapReady).not.toHaveBeenCalled();
    expect(world.worldmapConverged).not.toHaveBeenCalled();
  };

  it("takes no input, follows no facts and tells no entry it is ready when destroyed while its models load", async () => {
    let finishLoading!: () => void;
    const dispose = vi.fn();
    world.loadArt.mockImplementationOnce(() => new Promise((done) => (finishLoading = () => done({ dispose }))));
    const renderer = newRenderer();
    const starting = renderer.initScene();

    renderer.destroy();
    finishLoading();
    await starting;

    expect(dispose).toHaveBeenCalledOnce();
    expect(world.start).not.toHaveBeenCalled();
    expectNothingLeft();
  });

  it("starts no renderer when destroyed while its land is packed", async () => {
    let finishPacking!: () => void;
    world.pack.mockImplementationOnce(
      (_art, land, structures) => new Promise((done) => (finishPacking = () => done(packed(land, structures)))),
    );
    const renderer = newRenderer();
    const starting = renderer.initScene();
    await vi.waitFor(() => expect(world.pack).toHaveBeenCalledOnce());

    renderer.destroy();
    finishPacking();
    await starting;

    expect(world.start).not.toHaveBeenCalled();
    expectNothingLeft();
  });

  it("frees the renderer that starts after it was destroyed, and installs nothing", async () => {
    let finishStarting!: () => void;
    world.start.mockImplementationOnce(() => new Promise((done) => (finishStarting = () => done(world.native))));
    const renderer = newRenderer();
    const starting = renderer.initScene();
    await vi.waitFor(() => expect(world.start).toHaveBeenCalledOnce());

    renderer.destroy();
    finishStarting();
    await starting;

    expect(world.native.free).toHaveBeenCalledOnce();
    expectNothingLeft();
  });
});

describe("what the map tells the game's entry", () => {
  it("tells the entry that started it that the world map stands, and never that the realm view does", async () => {
    world.bootToken = 7;
    const renderer = newRenderer();
    const starting = renderer.initScene();
    world.bootToken = 8;
    await starting;

    expect(world.worldmapReady).toHaveBeenCalledWith(7);
    expect(world.worldmapConverged).toHaveBeenCalledWith(7);
    expect(world.hexReady).not.toHaveBeenCalled();
    renderer.destroy();
  });

  it("tells the game the realm view did not open when the address turns to it, and never that it is ready", async () => {
    world.scene = "map";
    const renderer = newRenderer();
    await renderer.initScene();
    expect(world.sceneFailed).not.toHaveBeenCalled();

    world.scene = "hex";
    window.dispatchEvent(new Event("urlChanged"));

    expect(world.sceneFailed).toHaveBeenCalledOnce();
    expect(world.sceneFailed.mock.calls[0].slice(0, 2)).toEqual([1, "hex"]);
    expect(world.hexReady).not.toHaveBeenCalled();
    renderer.destroy();
  });

  it("tells a boot that opens on the realm view that it did not open", async () => {
    world.scene = "hex";
    const renderer = newRenderer();
    await renderer.initScene();

    expect(world.sceneFailed).toHaveBeenCalledOnce();
    expect(world.hexReady).not.toHaveBeenCalled();
    renderer.destroy();
  });
});

describe("the backend the map starts on", () => {
  const onWebGL2 = (call: number) => world.start.mock.calls[call][5];

  it("is WebGL2 where the browser has no WebGPU", async () => {
    const renderer = newRenderer();
    await renderer.initScene();

    expect(world.start).toHaveBeenCalledOnce();
    expect(onWebGL2(0)).toBe(true);
    renderer.destroy();
  });

  it("is WebGPU where the browser has it", async () => {
    offerWebGPU();
    const renderer = newRenderer();
    await renderer.initScene();

    expect(world.start).toHaveBeenCalledOnce();
    expect(onWebGL2(0)).toBe(false);
    renderer.destroy();
  });

  it("is WebGL2 where the address asks for it, whatever the browser has", async () => {
    offerWebGPU();
    window.history.replaceState(null, "", "/?rendererMode=webgpu-force-webgl");
    const renderer = newRenderer();
    await renderer.initScene();

    expect(world.start).toHaveBeenCalledOnce();
    expect(onWebGL2(0)).toBe(true);
    renderer.destroy();
  });

  it.each(["No adapter of WebGPU was found", "The device could not be made"])(
    "is WebGL2, on a new canvas, when WebGPU does not start: %s",
    async (reason) => {
      offerWebGPU();
      world.start.mockRejectedValueOnce(reason);
      const renderer = newRenderer();
      await renderer.initScene();

      expect(world.start).toHaveBeenCalledTimes(2);
      expect([onWebGL2(0), onWebGL2(1)]).toEqual([false, true]);
      expect(world.start.mock.calls[1][0]).not.toBe(world.start.mock.calls[0][0]);
      expect(document.querySelectorAll("#main-canvas")).toHaveLength(1);
      expect(document.getElementById("main-canvas")).toBe(world.start.mock.calls[1][0]);
      expect(world.worldmapReady).toHaveBeenCalledOnce();
      renderer.destroy();
    },
  );

  it("stays on WebGL2 for every land after WebGPU failed once", async () => {
    offerWebGPU();
    world.start.mockRejectedValueOnce("No adapter of WebGPU was found");
    const renderer = newRenderer();
    await renderer.initScene();

    publish("tiles");
    await vi.advanceTimersByTimeAsync(250);

    expect(world.start).toHaveBeenCalledTimes(3);
    expect(onWebGL2(2)).toBe(true);
    renderer.destroy();
  });

  it("fails to start when WebGL2 does not start either", async () => {
    world.start.mockRejectedValue("No context");
    const renderer = newRenderer();

    await expect(renderer.initScene()).rejects.toBe("No context");
    renderer.destroy();
  });
});

describe("the labels the map says", () => {
  const NEAR = { entityId: 1, hex: HERE };
  const FAR = { entityId: 2, hex: { col: 500, row: 500 } };

  it("are those of the land held, said again when the armies change", async () => {
    world.plates = { structures: [NEAR, FAR], armies: [FAR] };
    const renderer = newRenderer();
    await renderer.initScene();
    expect(world.labels.showStructures.mock.lastCall![0]).toEqual([NEAR]);
    expect(world.labels.showArmies.mock.lastCall![0]).toEqual([]);

    world.plates.armies = [NEAR, FAR];
    publish("armies");
    expect(world.labels.showArmies.mock.lastCall![0]).toEqual([NEAR]);
    renderer.destroy();
  });

  it("ring the army or the structure picked, and none for a bare tile", async () => {
    const renderer = newRenderer();
    await renderer.initScene();
    world.picked({ kind: "army", entityId: 42n, tile: "own" });
    expect(world.labels.select).toHaveBeenLastCalledWith(42);
    world.picked({ kind: "hex", hex: HERE });
    expect(world.labels.select).toHaveBeenLastCalledWith(null);
    renderer.destroy();
  });

  it("go with the map", async () => {
    const renderer = newRenderer();
    await renderer.initScene();
    renderer.destroy();
    expect(world.labels.dispose).toHaveBeenCalledOnce();
  });
});

describe("a battle on the map", () => {
  const knight = (entityId: number, x: number) => ({ entityId, at: { x, z: 0 }, build: "knight", tint: [1, 1, 1] });
  const battle = (attacker: number, defender: number) =>
    world.event({
      model: "BattleEvent",
      value: {
        game_id: 1,
        attacker_id: attacker,
        defender_id: defender,
        attacker_owner: 7,
        defender_owner: 8,
        winner_id: 7,
        max_reward: [],
        timestamp: 0,
      },
    });
  /** What each knight does, in the order the renderer was last given them: 1 guards, 2 strikes. */
  const knightsDo = () => {
    const given = world.native.set_troop.mock.calls.findLast(([build]) => build === "knight")![1] as Float32Array;
    return Array.from({ length: given.length / 20 }, (_, unit) => given[unit * 20 + 6]);
  };

  beforeEach(() => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  });

  it("has both armies strike at each other", async () => {
    world.armies = [knight(1, 0), knight(2, 1), knight(3, 5)];
    const renderer = newRenderer();
    await renderer.initScene();
    expect(knightsDo()).toEqual([1, 1, 1]);
    battle(1, 2);
    expect(knightsDo()).toEqual([2, 2, 1]);
    renderer.destroy();
  });

  it("has an army strike at a structure it attacks", async () => {
    world.armies = [knight(1, 0)];
    world.placed.set(9, { hexCoords: { col: 1, row: 0, alt: false } });
    const renderer = newRenderer();
    await renderer.initScene();
    battle(1, 9);
    expect(knightsDo()).toEqual([2]);
    renderer.destroy();
  });

  it("shows nothing for a battle whose attacker the map does not hold", async () => {
    world.armies = [knight(2, 1)];
    const renderer = newRenderer();
    await renderer.initScene();
    const given = world.native.set_troop.mock.calls.length;
    battle(1, 2);
    expect(world.native.set_troop).toHaveBeenCalledTimes(given);
    renderer.destroy();
  });
});
