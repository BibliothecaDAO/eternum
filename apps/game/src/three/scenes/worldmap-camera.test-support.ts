import type { HexPosition } from "@bibliothecadao/types";
import { PerspectiveCamera } from "three";
import { vi } from "vitest";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { WORLD_HEX_SPACE } from "@/three/utils/utils";
import { setWorldOrigin, worldOrigin } from "@/three/world-origin";

import { HexagonScene } from "./hexagon-scene";
import WorldmapScene from "./worldmap";
import type { ArmySelectRequest } from "./worldmap-army-select-request";

/** The real map centre: a contract hex and its scene hex differ by it, about 2^31. */
export const MAP_CENTER = 2147483646;

/**
 * The world map's camera, read as a player's eye: every hex the scene moves or frames the camera onto, as scene
 * (normalized) hexes. The scene's own methods run, the army's selection included; only drawing and chunk loading are
 * left out. The player's army stands on `army` (a scene hex), drawn by the map unless `armyDrawn` is false. A chunk
 * switch keeps the selection, so a framing into another chunk changes nothing here. Given `drawnAround`, the map has
 * already drawn its first pass around that hex; each time it draws the world again, the origin it draws around is kept
 * in `redrawnAround`.
 */
export const worldMapCamera = (
  army: HexPosition,
  { drawnAround, armyDrawn = true }: { drawnAround?: HexPosition; armyDrawn?: boolean } = {},
) => {
  const aimed: HexPosition[] = [];
  const redrawnAround: HexPosition[] = [];
  setWorldOrigin(drawnAround ?? { col: 0, row: 0 });
  useAccountStore.setState({ account: { address: "0x7d79" } as never });
  vi.spyOn(
    HexagonScene.prototype as never as { moveCameraToColRow: () => void },
    "moveCameraToColRow",
  ).mockImplementation(((col: number, row: number) => aimed.push({ col, row })) as never);
  const camera = new PerspectiveCamera(30, 16 / 9, 1, 2000);
  camera.position.set(0, 40, 30);
  camera.lookAt(0, 0, 0);
  const openedCards: HexPosition[] = [];
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    worldOriginLocked: drawnAround !== undefined,
    hasInitialized: drawnAround !== undefined,
    redrawWorld: () => redrawnAround.push(worldOrigin()),
    camera,
    moveCameraToXYZ: (x: number, y: number, z: number) => {
      aimed.push(WORLD_HEX_SPACE.hexForPosition({ x, y, z }));
    },
    getArmyDisplayPosition: () => army,
    armyManager: { hasArmy: () => armyDrawn },
    runShortcutArmySelection: async (select: () => Promise<void>) => select(),
    refreshChunksAfterShortcutNavigation: async () => {},
    handleHexSelection: () => {},
    onArmySelection: (entityId: number) => {
      useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: entityId } }));
      return true;
    },
    state: { setLeftNavigationView: () => {} },
    openTargetCardForSelectedArmy: (site: HexPosition) => openedCards.push(site),
  }) as {
    camera: PerspectiveCamera;
    selectRequestedArmy: (request: ArmySelectRequest) => Promise<void>;
    openOnEntryDestination: () => Promise<void>;
    moveCameraToURLLocation: (options: { requestRefresh: boolean }) => void;
  };
  return { aimed, openedCards, redrawnAround, scene };
};

/** How far apart two scene hexes are, in hexes along the larger axis: enough to tell "here" from 2^30 hexes away. */
export const hexesApart = (left: HexPosition, right: HexPosition): number =>
  Math.max(Math.abs(left.col - right.col), Math.abs(left.row - right.row));
