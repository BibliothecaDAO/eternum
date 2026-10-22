// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

const { world } = vi.hoisted(() => ({
  world: {
    projection: null as null | import("@bibliothecadao/eternum/game-sync").WorldSpatialProjection,
    /** The chain's answer to a sent use, once it lands: the stream applies the vacated tile. */
    land: (() => {}) as (hash: string) => void,
  },
}));

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));
vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({
    waitForAction: async (hash: string) => {
      world.land(hash);
      return { hash, block: 9, status: "SUCCEEDED" };
    },
  }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 350,
  useNowSeconds: () => 350,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: Array<{ col: number; row: number }>) =>
    hexes.flatMap((hex) => world.projection?.getTileAtHex({ ...hex, alt: false }) ?? []),
}));

const { buildArmyPathIndexes, findArmyPaths, Position, setBlockTimestampSource } =
  await import("@bibliothecadao/eternum");
const { WorldSpatialProjection } = await import("@bibliothecadao/eternum/game-sync");
const { EternumProvider, encodeNativeCommand } = await import("@bibliothecadao/provider");
const { ContractAddress, createSystemCalls } = await import("@bibliothecadao/types");
const { GameProvider } = await import("@/hooks/context/game-context");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { InputManager } = await import("../managers/input-manager");
const { MapSiteCard, useSelectedMapSite } = await import("@/ui/features/frontier/sites/map-site-card");
const { ARMY_TILE, FAR_SHRINE_TILE, SHRINE_TILE, sitesBeside, WELL_TILE } =
  await import("@/ui/features/frontier/sites/site-fixture");
const { SceneName } = await import("../types");
const { default: WorldmapScene } = await import("./worldmap");
const { default: bindings } = await import("../../../../../contracts/l3/world-native/schema/bindings.json");

const WORLD = "0x5e5e";
const ARMY = 201;
const NOW = 350;
type Tile = typeof SHRINE_TILE;

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  useAccountStore.setState({ account: null });
  world.projection?.dispose();
  world.projection = null;
  setBlockTimestampSource(null);
  vi.useRealTimers();
});

/**
 * The world map's own handlers on the sites fixture's Frontier day, driven by the player's input as the game takes it:
 * the map's InputManager on its surface, the scene's listeners (setupInputHandlers), and WorldmapScene's click,
 * right-click, tap rule, order dispatch and order line. Its orders come from the real planner over the projected world
 * (armyPaths). A use goes through the real system calls and EternumProvider, which build the InteractSite call from
 * the world's command ABI; the native submission records that call where the game would sign it. Only the tile under
 * the pointer (the canvas raycast) is set by the test, and the chain's answer (the tile vacated) by the outcome wait.
 */
const theMap = (stamina: bigint) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store, vacate } = sitesBeside(stamina);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  world.projection = projection;

  const submitted: { contractAddress: string; entrypoint: string; calldata: string[] }[] = [];
  const sentTo = new Map<string, Tile>();
  const provider = new EternumProvider({ world: WORLD } as never, "http://127.0.0.1:9", { gameId: 1 });
  provider.setNativeSubmission(
    async (_signer, calls) => {
      const call = (Array.isArray(calls) ? calls[0] : calls) as (typeof submitted)[number];
      submitted.push({ ...call, calldata: call.calldata.map(String) });
      const hash = `0x${submitted.length}`;
      // The fixture site this call names, by the world ABI's own encoding of a use there.
      const tile = [SHRINE_TILE, WELL_TILE, FAR_SHRINE_TILE].find(
        (site) => JSON.stringify(interactSite(site)) === JSON.stringify(submitted.at(-1)),
      );
      if (tile) sentTo.set(hash, tile);
      return { transaction_hash: hash };
    },
    bindings.commandAbi as never,
    () => 7,
  );
  world.land = (hash) => {
    const tile = sentTo.get(hash);
    if (tile) vacate(tile);
  };
  const systemCalls = createSystemCalls({ provider });
  const signer = { address: "0x111" } as never;
  useAccountStore.setState({ account: signer });
  const setup = { store, systemCalls } as never;

  // The map's input: its manager on a surface, the scene's own listeners; the raycast says which tile is pointed at.
  const pointed = { hex: null as null | { col: number; row: number } };
  const surface = document.createElement("div");
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
  const inputManager = new InputManager(
    SceneName.WorldMap,
    { getCurrentScene: () => SceneName.WorldMap } as never,
    { setFromCamera: () => {} } as never,
    new THREE.Vector2(),
    new THREE.PerspectiveCamera(),
  );
  inputManager.setSurface(surface);
  inputManager.activate();
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    game: setup,
    state: useUIStore.getState(),
    inputManager,
    interactiveHexManager: { onClick: () => (pointed.hex ? { hexCoords: pointed.hex } : null) },
    worldSpatialProjection: projection,
    armyManager: { isArmySelectable: () => true },
    exploredTiles: new Map(),
    orderRefusals: new Map(),
    chunkTransitionToken: 1,
    actionPathsTransitionToken: 1,
    pointerOrderTip: { take: () => {}, refresh: () => {} },
    getHexagonEntity: () => ({}),
    queuesNextOrder: () => false,
    hudCarriesOrderVerb: () => false,
    getInteractionDebugSnapshot: () => ({}),
  });
  scene.setupInputHandlers();

  /** The scene's tile for a contract tile: the hex the raycast returns and the scene's handlers take. */
  const sceneHex = (tile: Tile) => {
    const normalized = Position.fromContract({ x: tile.col, y: tile.row }).getNormalized();
    return { col: normalized.x, row: normalized.y };
  };
  /** The player selects their army: the map plans its orders from where it stands (offerSelectedArmyOrders). */
  const plan = () => {
    const paths = findArmyPaths({ setup } as never, {
      explorerId: ARMY,
      ...buildArmyPathIndexes({ setup, projection } as never),
      currentDefaultTick: NOW,
      playerAddress: ContractAddress(0x111n),
    });
    act(() => scene.updateEntityActionPaths(paths.getPaths(), paths.getRefusals()));
  };
  act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));
  plan();

  const at = (tile: Tile) => (pointed.hex = sceneHex(tile));
  return {
    store,
    setup,
    submitted,
    plan,
    /** The line under the pointer at the tile, as the scene names it. */
    hover: (tile: Tile) => scene.nameOrderAt(sceneHex(tile)),
    rightClick: async (tile: Tile) => {
      at(tile);
      await act(async () => {
        surface.dispatchEvent(new MouseEvent("contextmenu", { clientX: 700, clientY: 400, cancelable: true }));
      });
    },
    /** A touch held past the long press: the touch's right-click. */
    hold: async (tile: Tile) => {
      at(tile);
      vi.useFakeTimers();
      const touch = (type: string) =>
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: "touch",
          clientX: 700,
          clientY: 400,
          bubbles: true,
          cancelable: true,
        });
      surface.dispatchEvent(touch("pointerdown"));
      vi.advanceTimersByTime(600);
      surface.dispatchEvent(touch("pointerup"));
      vi.useRealTimers();
      await act(async () => {});
    },
    click: (tile: Tile) => {
      at(tile);
      act(() => {
        surface.dispatchEvent(new MouseEvent("click", { clientX: 700, clientY: 400 }));
      });
    },
  };
};

/** The use the provider built, as the world's ABI encodes it for this army at this tile. */
const interactSite = (tile: Tile) => ({
  contractAddress: WORLD,
  entrypoint: "InteractSite",
  calldata: [
    "1",
    ...encodeNativeCommand(bindings.commandAbi as never, {
      kind: "InteractSite",
      value: { explorer_id: ARMY, coord: { alt: false, x: tile.col, y: tile.row } },
    }),
  ].map(String),
});

const armyTile = (store: ReturnType<typeof sitesBeside>["store"]) => {
  const at = store.entityOccupancy(1, ARMY);
  return at && { col: at.col, row: at.row, alt: at.alt };
};
const standing = (store: ReturnType<typeof sitesBeside>["store"], tile: Tile) =>
  store.get("TileOccupancy", { game_id: 1, ...tile }) !== undefined;

/** The HUD's card for the map's selection, as the Frontier HUD's selection sheet draws a site's. */
const drawSelectedSite = (setup: unknown) => {
  const Sheet = () => {
    const site = useSelectedMapSite();
    return site ? <MapSiteCard selected={site} onClose={() => {}} /> : null;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={setup as never} account={{ address: "0x111", account: { address: "0x111" } } as never}>
        <Sheet />
      </GameProvider>,
    ),
  );
  return {
    label: () => host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
    use: () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Use"),
    unmount: () => act(() => root.unmount()),
  };
};

describe("a Shrine or a Well beside the selected army, on the world map", () => {
  it.each([
    { kind: "Shrine", tile: SHRINE_TILE, gives: "+200 XP", gesture: "rightClick" },
    { kind: "Well", tile: WELL_TILE, gives: "+60 stamina", gesture: "rightClick" },
    { kind: "Shrine", tile: SHRINE_TILE, gives: "+200 XP", gesture: "hold" },
    { kind: "Well", tile: WELL_TILE, gives: "+60 stamina", gesture: "hold" },
  ] as const)(
    "a $gesture on the $kind sends its InteractSite where the army stands",
    async ({ tile, gives, gesture }) => {
      const map = theMap(30n);
      expect(map.hover(tile)).toEqual({ line: "Use", cost: gives });

      await map[gesture](tile);

      expect(map.submitted).toEqual([interactSite(tile)]);
      expect(standing(map.store, tile)).toBe(false);
      expect(armyTile(map.store)).toEqual(ARMY_TILE);
      // The army is still selected, and once it is offered orders again the spent site offers no Use.
      expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
      map.plan();
      expect(map.hover(tile)?.line).not.toBe("Use");
    },
  );

  it.each([
    { kind: "Shrine", tile: SHRINE_TILE },
    { kind: "Well", tile: WELL_TILE },
  ] as const)(
    "a click on the $kind opens its card with the army kept, and its Use sends the same call",
    async ({ kind, tile }) => {
      const map = theMap(30n);

      map.click(tile);
      // The card's Use goes through the same system calls the map holds.
      const sheet = drawSelectedSite(map.setup);
      expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
      expect(useUIStore.getState().selectedHex).toEqual({ col: tile.col, row: tile.row });
      expect(sheet.label()).toBe(kind);
      expect(sheet.use()?.disabled).toBe(false);

      await act(async () => sheet.use()!.click());
      expect(map.submitted).toEqual([interactSite(tile)]);
      expect(armyTile(map.store)).toEqual(ARMY_TILE);
      sheet.unmount();
    },
  );

  it("warns on a Well at a full bar that its stamina would be wasted, and still offers its Use", () => {
    const map = theMap(150n);
    expect(map.hover(WELL_TILE)).toEqual({ line: "Use", cost: "Stamina full: the well would be wasted" });
  });

  it("says to move next to a site beyond the army's step; a right-click there sends nothing", async () => {
    const map = theMap(30n);
    expect(map.hover(FAR_SHRINE_TILE)).toEqual({ line: "Too far: move next to it", cost: null });
    await map.rightClick(FAR_SHRINE_TILE);
    expect(map.submitted).toEqual([]);
    expect(standing(map.store, FAR_SHRINE_TILE)).toBe(true);
  });
});
