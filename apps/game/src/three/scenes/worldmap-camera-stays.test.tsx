// @vitest-environment jsdom
import type { ActionPath } from "@bibliothecadao/eternum";
import { PerspectiveCamera } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

const { ActionPaths, ActionType, configManager } = await import("@bibliothecadao/eternum");
const { attachMapSelectionPositions } = await import("@/hooks/store/map-selection");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { usePopoverStore } = await import("@/hooks/store/use-popover-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { HexagonScene } = await import("./hexagon-scene");
const { default: WorldmapScene } = await import("./worldmap");
const { MAP_CENTER } = await import("./worldmap-camera.test-support");
const { WORLD_HEX_SPACE } = await import("@/three/utils/utils");

type Hex = { col: number; row: number };

const ARMY = 7;
const ENEMY = 90;
/** The player's army, an unexplored tile beside it, an explored one, and an enemy army beside it, as scene hexes. */
const ARMY_HEX = { col: 4, row: 5 };
const UNEXPLORED = { col: 5, row: 5 };
const EXPLORED = { col: 4, row: 6 };
const ENEMY_HEX = { col: 3, row: 5 };
const contract = (hex: Hex) => ({ col: MAP_CENTER + hex.col, row: MAP_CENTER + hex.row });
const sameHex = (left: Hex, right: Hex) => left.col === right.col && left.row === right.row;

/** The army's orders, as the rules plan them: explore, move and attack, each one step from its tile. */
const orders = () =>
  new Map<string, ActionPath[]>(
    (
      [
        [UNEXPLORED, ActionType.Explore],
        [EXPLORED, ActionType.Move],
        [ENEMY_HEX, ActionType.Attack],
      ] as const
    ).map(([hex, actionType]) => [
      ActionPaths.posKey(hex, true),
      [
        { hex: contract(ARMY_HEX), actionType: ActionType.Move },
        { hex: contract(hex), actionType, staminaCost: 10 },
      ] as ActionPath[],
    ]),
  );

/** The screen: a desktop at 1440×900, or a phone at 390×844 below the HUD's desktop width. */
const screen = (desktop: boolean) => {
  const [width, height] = desktop ? [1440, 900] : [390, 844];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
};

/**
 * The player's camera, panned away from the army: every tile the test acts on stands off screen, where a card would cover
 * it, so any framing would move the camera.
 */
const cameraLookingAway = () => {
  const { x, y, z } = WORLD_HEX_SPACE.positionForHex({ col: 60, row: 60 });
  const camera = new PerspectiveCamera(30, 16 / 9, 1, 2000);
  camera.position.set(x, y + 40, z + 30);
  camera.lookAt(x, y, z);
  camera.updateMatrixWorld();
  return camera;
};

/** Frames the page has asked for: a tap's follow-up waits for them, so each tap runs them before the camera is read. */
let frames: FrameRequestCallback[] = [];
const flushFrames = () => {
  while (frames.length > 0) frames.shift()!(0);
};

/** Every way a scene moves its camera, each call recorded by name: the test fails on any. */
const watchCamera = () => {
  const moves: string[] = [];
  const watch = (prototype: object, name: string) =>
    vi.spyOn(prototype as Record<string, () => void>, name).mockImplementation(() => void moves.push(name));
  for (const name of ["moveCameraToXYZ", "moveCameraToColRow", "centerOnOpenMap", "cameraAnimate", "placeCamera"])
    watch(HexagonScene.prototype, name);
  watch(WorldmapScene.prototype, "moveCameraToMapPosition");
  return moves;
};

/**
 * Frontier's or Blitz's world map with the player's army selected beside an unexplored tile, an explored one and an enemy
 * army. The scene's own input runs: the tap and the right-click, the order each picks, its dispatch and the attack's
 * card. Left out are drawing and what an explore or a move sends (`onArmyMovement`, recorded).
 */
const worldMap = (frontier: boolean) => {
  const sent: Hex[] = [];
  const surfaces: string[] = [];
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    camera: cameraLookingAway(),
    actionPathsTransitionToken: 1,
    chunkTransitionToken: 1,
    factsShown: false,
    orderRefusals: new Map(),
    exploredTiles: new Map(),
    getHexagonEntity: (hex: Hex) => {
      if (sameHex(hex, ARMY_HEX)) return { army: { id: ARMY, owner: 0x7d79n } };
      return sameHex(hex, ENEMY_HEX) ? { army: { id: ENEMY, owner: 0x999n } } : {};
    },
    getOwnArmyOrderedTo: () => undefined,
    worldSpatialProjection: {
      getArmy: (id: number) => (id === ARMY ? {} : undefined),
      getStructuresAtHex: () => [],
    },
    armyManager: { isArmySelectable: () => true, hasArmy: () => true },
    game: { store: { get: () => undefined } },
    isFrontierHud: () => frontier,
    usableSiteAt: () => null,
    isArmysSpire: () => false,
    hasOrderInFlight: () => false,
    pointerOrderTip: { take: () => {}, hold: () => {}, refresh: () => {} },
    logInteractionDebug: () => {},
    getInteractionDebugSnapshot: () => ({}),
    state: {
      get selectedHex() {
        return useUIStore.getState().selectedHex;
      },
      selectOnMap: useUIStore.getState().selectOnMap,
      updateEntityActionHoveredHex: (hex: Hex | null) =>
        useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, hoveredHex: hex } })),
    },
    onArmyMovement: (path: ActionPath[]) => sent.push(path[path.length - 1].hex),
    interactionAdapter: {
      selectHex: ({ contractHexPosition }: { contractHexPosition: { x: number; y: number } }) =>
        useUIStore
          .getState()
          .selectOnMap({ kind: "hex", hex: { col: contractHexPosition.x, row: contractHexPosition.y } }),
    },
    clearEntitySelection: () => {},
    openTargetActionSurface: (_: Hex, surface: { id: string }) => surfaces.push(surface.id),
  }) as {
    onHexagonClick: (hex: Hex) => void;
    onHexagonRightClick: (event: MouseEvent, hex: Hex) => void;
  };
  const tap = (hex: Hex) => {
    scene.onHexagonClick(hex);
    flushFrames();
  };
  const rightClick = (hex: Hex) => {
    scene.onHexagonRightClick(new MouseEvent("contextmenu"), hex);
    flushFrames();
  };
  return { tap, rightClick, sent, surfaces };
};

/** What the attack opened: its forecast, or the target's card with the army as its actor. */
const attackShown = (surfaces: string[]) => {
  const selection = useUIStore.getState().mapSelection;
  const cardOnEnemy = selection?.kind === "army" && selection.tile !== "own" && selection.tile !== null;
  return surfaces.includes("quick-attack") || cardOnEnemy;
};

let detachPositions = () => {};
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  // The map's canvas, where a tile's place on screen is read.
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
  document.body.replaceChildren(canvas);
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "isCommandEnabled").mockReturnValue(true);
  vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(10);
  useAccountStore.setState({ account: { address: "0x7d79" } as never });
  // Where the store reads a selection's tile: the army stands on its own.
  detachPositions = attachMapSelectionPositions({
    army: () => ({ ...contract(ARMY_HEX), alt: false }),
    structure: () => undefined,
  });
  useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" });
  useUIStore.setState((state) => ({
    entityActions: { ...state.entityActions, selectedEntityId: ARMY, actionPaths: orders(), hoveredHex: null },
  }));
  usePopoverStore.setState({ openId: null, surface: null });
});
afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  detachPositions();
  useAccountStore.setState({ account: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 28 October 2026: "it moves the camera when I fight for example ? pretty sure there's more stuff that center the
// camera that shouldnt ?"
describe.each([
  ["Frontier", true],
  ["Blitz", false],
])("%s's world map leaves the camera where the player put it", (_, frontier) => {
  it("on a desktop, a right-click explores, moves and attacks", () => {
    screen(true);
    const moves = watchCamera();
    const { rightClick, sent, surfaces } = worldMap(frontier);

    rightClick(UNEXPLORED);
    rightClick(EXPLORED);
    rightClick(ENEMY_HEX);

    expect(sent).toEqual([contract(UNEXPLORED), contract(EXPLORED)]);
    expect(attackShown(surfaces)).toBe(true);
    expect(moves).toEqual([]);
  });

  it("on a desktop, a click on the enemy opens the fight", () => {
    screen(true);
    const moves = watchCamera();
    const { tap, surfaces } = worldMap(frontier);

    tap(ENEMY_HEX);

    expect(attackShown(surfaces)).toBe(true);
    expect(moves).toEqual([]);
  });

  it("on a phone, taps explore, move and open the fight", () => {
    screen(false);
    const moves = watchCamera();
    const { tap, sent, surfaces } = worldMap(frontier);

    for (const tile of [UNEXPLORED, EXPLORED]) {
      tap(tile);
      // Frontier pins the order for the HUD's verb, the same tile tapped again sends it; Blitz opens its preview.
      if (frontier) tap(tile);
    }
    tap(ENEMY_HEX);

    if (frontier) expect(sent).toEqual([contract(UNEXPLORED), contract(EXPLORED)]);
    else expect(surfaces).toContain("order-preview");
    expect(attackShown(surfaces)).toBe(true);
    expect(moves).toEqual([]);
  });

  it.each([
    ["a desktop", true],
    ["a phone", false],
  ])("on %s, a tap on a tile with no army selected opens its card", (_, desktop) => {
    screen(desktop);
    const moves = watchCamera();
    const { tap } = worldMap(frontier);
    useUIStore.getState().selectOnMap(null);

    tap(EXPLORED);

    expect(useUIStore.getState().selectedHex).toEqual(contract(EXPLORED));
    expect(moves).toEqual([]);
  });
});
