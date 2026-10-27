// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

const { configManager } = await import("@bibliothecadao/eternum");
const { Direction, getNeighborHexes } = await import("@bibliothecadao/types");
const { getWorldPositionForHex } = await import("../utils/utils");
const { attachMapSelectionPositions } = await import("@/hooks/store/map-selection");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { DEPLOY_ON_MAP_EVENT, readDeployOnMap, showDeployOnMap } = await import("./worldmap-deploy-request");
const { MAP_CENTER, worldMapCamera } = await import("./worldmap-camera.test-support");

const ARMY = 201;
const REALM = 9;
/** The realm's tile, far outside the map's open area from where the player has the camera, as scene hexes. */
const REALM_HEX = { col: 40, row: -30 };
const LOOKING_AT = { col: 0, row: 0 };
const contract = (hex: { col: number; row: number }) => ({ col: MAP_CENTER + hex.col, row: MAP_CENTER + hex.row });

/** The screen: a desktop at 1440×900, or a phone at 384×832 below the HUD's desktop width. */
const screen = (desktop: boolean) => {
  const [width, height] = desktop ? [1440, 900] : [384, 832];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  // The map's canvas, where a tile's place on screen is read.
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect;
  document.body.replaceChildren(canvas);
};

/** Frames the map waits for before reading where a card stands; run when the test flushes them. */
let frames: FrameRequestCallback[] = [];
const flushFrames = () => {
  while (frames.length > 0) frames.shift()!(0);
};

/**
 * Frontier's world map with the player's army selected and the camera away from the realm. Its own selection runs: the
 * realm's selection, the store's derivation of the selected tile, and the map's callback for that tile, subscribed as
 * the map's store bridge subscribes it. Drawing, the realm's order planning and the camera's own motion are recorded or
 * left out (worldMapCamera).
 */
const worldMap = () => {
  const { aimed, scene } = worldMapCamera(LOOKING_AT, { drawnAround: LOOKING_AT });
  const selectedTiles: unknown[] = [];
  const map = Object.assign(scene, {
    isFrontierHud: () => true,
    getStructureHexPosition: () => REALM_HEX,
    state: { ...useUIStore.getState(), setStructureEntityId: () => {} },
    game: { store: { get: () => undefined } },
    updateEntityActionPaths: () => {},
    highlightHexManager: { highlightHexes: () => {} },
    showSelectedHexRing: (hex: unknown) => selectedTiles.push(hex),
    refreshSelectedPlate: () => {},
    worldSpatialProjection: { getStructure: () => ({ hexCoords: contract(REALM_HEX) }) },
    orderTargetRing: { setHoverColor: () => {}, showHover: () => {}, hideHover: () => {} },
  }) as unknown as {
    camera: { position: { clone: () => unknown } };
    showDeployOrder: (order: unknown) => void;
    showSelectedTile: (hex: unknown) => void;
    onHexagonClick: (hex: { col: number; row: number }) => void;
  };
  const unsubscribe = useUIStore.subscribe(
    (state) => state.selectedHex,
    (hex) => map.showSelectedTile(hex),
  );
  // The map's own listener: what its deploy handler does with the sheet's order.
  const hear = (event: Event) => map.showDeployOrder(readDeployOnMap(event));
  window.addEventListener(DEPLOY_ON_MAP_EVENT, hear);
  const stop = () => {
    unsubscribe();
    window.removeEventListener(DEPLOY_ON_MAP_EVENT, hear);
  };
  return { aimed, map, selectedTiles, stop };
};

let cleanups: (() => void)[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  cleanups.push(
    attachMapSelectionPositions({
      army: () => ({ ...contract(LOOKING_AT), alt: false }),
      structure: () => ({ ...contract(REALM_HEX), alt: false }),
    }),
  );
  useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" });
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  showDeployOnMap(null);
  useUIStore.getState().selectOnMap(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 27 October 2026: "when I right click to deploy an army stop centering the camera on the realm ffs".
it.each([
  ["a desktop's right-click", true],
  ["a phone's tap, or the dock's Deploy", false],
])(
  "Deploy opened by %s, with an army selected, selects the realm and leaves the camera where the player had it",
  (_, desktop) => {
    screen(desktop);
    const world = worldMap();
    cleanups.push(world.stop);
    const before = world.map.camera.position.clone();

    showDeployOnMap({ structureId: REALM, direction: Direction.EAST });
    showDeployOnMap({ structureId: REALM, direction: Direction.SOUTH_EAST });
    flushFrames();

    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(REALM);
    expect(world.selectedTiles.at(-1)).toEqual(contract(REALM_HEX));
    expect(world.aimed).toEqual([]);
    expect(world.map.camera.position).toEqual(before);
  },
);

// Audit hud 12 (27 October 2026): Deploy "lands on a neighbouring tile the player never picked, nothing names the target".
it.each([
  ["a desktop", true],
  ["a phone", false],
])(
  "on %s, Deploy rings the tile its army steps out on, follows another pick, and lets the ring go when it closes",
  (_, desktop) => {
    screen(desktop);
    const world = worldMap();
    cleanups.push(world.stop);
    const rings: ({ x: number; z: number } | null)[] = [];
    Object.assign(world.map, {
      // Closing also lets go of the realm the sheet selected; here only the ring is read.
      clearEntitySelection: () => {},
      orderTargetRing: {
        setHoverColor: () => {},
        showHover: (x: number, z: number) => rings.push({ x, z }),
        hideHover: () => rings.push(null),
      },
    });
    /** Where a tile beside the realm stands in the world, as the map draws it. */
    const beside = (direction: number) => {
      const tile = getNeighborHexes(contract(REALM_HEX).col, contract(REALM_HEX).row).find(
        (neighbor) => neighbor.direction === direction,
      )!;
      const { x, z } = getWorldPositionForHex({ col: tile.col - MAP_CENTER, row: tile.row - MAP_CENTER });
      return { x, z };
    };

    // Opened with the sheet's own pick, the first open tile: the player picked none.
    showDeployOnMap({ structureId: REALM, direction: Direction.EAST });
    expect(rings.at(-1)).toEqual(beside(Direction.EAST));
    showDeployOnMap({ structureId: REALM, direction: Direction.SOUTH_EAST });
    expect(rings.at(-1)).toEqual(beside(Direction.SOUTH_EAST));
    showDeployOnMap(null);
    expect(rings.at(-1)).toBeNull();
  },
);

// Owner, 26 October 2026 (layout A): on a phone the player's own tap on a tile its card would cover still frames it.
it("on a phone, a tap on a far tile still frames it above its card", () => {
  screen(false);
  const world = worldMap();
  cleanups.push(world.stop);
  useUIStore.getState().selectOnMap(null);
  Object.assign(world.map, {
    getHexagonEntity: () => ({}),
    getOwnArmyOrderedTo: () => undefined,
    logInteractionDebug: () => {},
    getInteractionDebugSnapshot: () => ({}),
    clearEntitySelection: () => {},
    interactionAdapter: {
      selectHex: ({ contractHexPosition }: { contractHexPosition: { x: number; y: number } }) =>
        useUIStore
          .getState()
          .selectOnMap({ kind: "hex", hex: { col: contractHexPosition.x, row: contractHexPosition.y } }),
    },
  });

  world.map.onHexagonClick(REALM_HEX);
  flushFrames();

  expect(world.aimed.length).toBeGreaterThan(0);
});
