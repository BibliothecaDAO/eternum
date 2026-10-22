import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildArmyPathIndexes, findArmyPaths, getBlockTimestamp } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { encodeNativeCommand, EternumProvider } from "@bibliothecadao/provider";
import { ContractAddress, createSystemCalls, type HexPosition } from "@bibliothecadao/types";
import { type Camera, Raycaster, Vector2 } from "three";

import bindings from "../../../../../contracts/l3/world-native/schema/bindings.json";
import { InputManager } from "../managers/input-manager";
import type { MapPlateLayer } from "../map-plates/map-plate-layer";
import WorldmapScene from "../scenes/worldmap";
import { PointerOrderTip } from "../scenes/worldmap-order-tip";
import { SceneName } from "../types";

/** The address the recorded calls go to; nothing listens there. */
export const HARNESS_WORLD = "0x5e5e";

/** A call as the game would sign and send it: the world, the command's entrypoint and its ABI-encoded calldata. */
type RecordedCall = { contractAddress: string; entrypoint: string; calldata: string[] };

/**
 * The game's own system calls over the real EternumProvider, which builds every command from the world's command ABI;
 * each call is recorded at the native submission, where the game signs and sends it, and `onCall` hears it there.
 */
export const recordingSystemCalls = (onCall: (call: RecordedCall, hash: string) => void = () => {}) => {
  const recorded: RecordedCall[] = [];
  const provider = new EternumProvider({ world: HARNESS_WORLD } as never, "http://127.0.0.1:9", { gameId: 1 });
  provider.setNativeSubmission(
    async (_signer, calls) => {
      const call = (Array.isArray(calls) ? calls[0] : calls) as RecordedCall;
      const sent = { ...call, calldata: call.calldata.map(String) };
      recorded.push(sent);
      const hash = `0x${recorded.length}`;
      onCall(sent, hash);
      return { transaction_hash: hash };
    },
    bindings.commandAbi as never,
    () => 7,
  );
  return { systemCalls: createSystemCalls({ provider }), recorded };
};

/** Which of `tiles` a recorded call uses with this army: the one whose InteractSite the world's ABI encodes as it. */
export const siteOfCall = <T extends { col: number; row: number; alt: boolean }>(
  call: RecordedCall,
  explorerId: number,
  tiles: readonly T[],
): T | null => {
  const encoded = (tile: T) => [
    "1",
    ...encodeNativeCommand(bindings.commandAbi as never, {
      kind: "InteractSite",
      value: { explorer_id: explorerId, coord: { alt: tile.alt, x: tile.col, y: tile.row } },
    }).map(String),
  ];
  if (call.entrypoint !== "InteractSite") return null;
  return tiles.find((tile) => encoded(tile).join() === call.calldata.join()) ?? null;
};

/**
 * The world map's own input and handlers for an army's orders, over a fixture game: the map's InputManager on the
 * surface, and WorldmapScene's click and right-click handlers (hexagon-scene's handleClick and handleRightClick, then
 * the world map's tap rule, order dispatch and site card) and its order line (nameOrderAt, placed by placeOrderTip).
 * They run on the class itself, as the order preview test runs them, rather than a whole renderer and sync runtime;
 * the pointer's tile is the caller's raycast. The army's orders come from the real planner over the projected world
 * (armyPaths), handed to the scene as offerSelectedArmyOrders hands them. Mousemove points the order line only; the
 * scene's full hover (labels, highlights) belongs to the renderer.
 */
export const mountWorldmapSiteHarness = ({
  setup,
  projection,
  surface,
  camera,
  mapPlates,
  army,
  player,
  tileUnder,
}: {
  setup: Pick<GameClientSetup, "store" | "systemCalls">;
  projection: WorldSpatialProjection;
  surface: HTMLElement;
  camera: Camera;
  mapPlates: Pick<MapPlateLayer, "placeOrderLine">;
  army: number;
  player: bigint;
  /** The scene hex (normalized) under the pointer, from the input manager's raycaster. */
  tileUnder: (raycaster: Raycaster) => HexPosition | null;
}) => {
  const raycaster = new Raycaster();
  const inputManager = new InputManager(
    SceneName.WorldMap,
    { getCurrentScene: () => SceneName.WorldMap } as never,
    raycaster,
    new Vector2(),
    camera,
  );
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    game: setup,
    state: useUIStore.getState(),
    camera,
    mapPlates,
    inputManager,
    interactiveHexManager: { onClick: (ray: Raycaster) => hit(ray) },
    worldSpatialProjection: projection,
    armyManager: { isArmySelectable: () => true },
    exploredTiles: new Map(),
    orderRefusals: new Map(),
    chunkTransitionToken: 1,
    actionPathsTransitionToken: 1,
    getHexagonEntity: () => ({}),
    queuesNextOrder: () => false,
    hudCarriesOrderVerb: () => false,
    getInteractionDebugSnapshot: () => ({}),
  });
  scene.pointerOrderTip = new PointerOrderTip(
    (hex) => scene.placeOrderTip(hex),
    () => mapPlates.placeOrderLine(null),
    (hex, line) => scene.placeLineAt(hex, line),
  );
  const hit = (ray: Raycaster) => {
    const hex = tileUnder(ray);
    return hex && { hexCoords: hex };
  };
  inputManager.addListener("click", scene.handleClick.bind(scene));
  inputManager.addListener("contextmenu", scene.handleRightClick.bind(scene));
  inputManager.addListener("mousemove", (_event, ray) => scene.pointerOrderTip.point(tileUnder(ray)));
  inputManager.setSurface(surface);
  inputManager.activate();

  /** The army's orders from where it stands, as offerSelectedArmyOrders plans and hands them to the scene. */
  const plan = () => {
    const paths = findArmyPaths({ setup } as never, {
      explorerId: army,
      ...buildArmyPathIndexes({ setup, projection } as never),
      currentDefaultTick: getBlockTimestamp().currentDefaultTick,
      playerAddress: ContractAddress(player),
    });
    scene.updateEntityActionPaths(paths.getPaths(), paths.getRefusals());
  };
  return {
    scene: scene as {
      nameOrderAt: (hex: HexPosition) => { line: string; cost: string | null } | null;
      updateEntityActionPaths: (...args: unknown[]) => void;
    },
    /** The player selects the army, as a tap on it does: the map then offers its orders. */
    selectArmy: () => {
      useUIStore.getState().selectOnMap({ kind: "army", entityId: army, tile: "own" });
      plan();
    },
    plan,
    dispose: () => inputManager.destroy(),
  };
};
