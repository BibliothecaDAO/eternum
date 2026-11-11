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
  inputs: vi.fn(),
}));

const subscribe = (name: string) => (listener: Listener) => {
  world.listeners.set(name, listener);
  return () => world.listeners.delete(name);
};
const projection = {
  subscribeArmies: subscribe("armies"),
  subscribeTiles: subscribe("tiles"),
  subscribeStructures: subscribe("structures"),
};

vi.mock("@bibliothecadao/eternum/game-sync", () => ({
  requireActiveGameSyncRuntime: () => ({ requireWorldSpatialProjection: () => projection }),
}));
vi.mock("@/game-entry/play-route-readiness-store", () => ({
  getCurrentPlayRouteBootToken: () => world.bootToken,
  usePlayRouteReadinessStore: {
    getState: () => ({
      markWorldmapReady: world.worldmapReady,
      markWorldmapConverged: world.worldmapConverged,
      markHexReady: world.hexReady,
    }),
  },
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: { getState: () => ({ setIsLoadingScreenEnabled: vi.fn(), setCameraTargetHex: vi.fn() }) },
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
  readArmies: () => [],
  readStructures: () => world.structures,
  readTiles: () => world.tiles,
}));
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
const packed = (land: unknown, structures: unknown) => ({
  table: JSON.stringify({ land, structures }),
  buffer: new Uint8Array(),
});
/** What the renderer was last started on: the land and the structures packed for it. */
const drawn = () => JSON.parse(world.start.mock.calls.at(-1)![1] as string);
const publish = (name: "tiles" | "structures", changes: Hex[] = [HERE]) => world.listeners.get(name)!(changes);
const offerWebGPU = () => Object.defineProperty(navigator, "gpu", { value: {}, configurable: true });

function newRenderer() {
  return new MapClientRenderer({ store: {} } as unknown as GameClientSetup);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  world.tiles = [{ ...HERE, biome: 1, occupied: false }];
  world.structures = [];
  world.listeners.clear();
  world.scene = null;
  world.bootToken = 1;
  world.loadArt.mockImplementation(async () => ({ dispose: vi.fn() }));
  world.pack.mockImplementation(async (_art, land, structures) => packed(land, structures));
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
