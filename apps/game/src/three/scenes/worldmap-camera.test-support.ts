import type { HexPosition } from "@bibliothecadao/types";
import { PerspectiveCamera } from "three";
import { vi } from "vitest";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { WORLD_HEX_SPACE } from "@/three/utils/utils";
import { setWorldOrigin } from "@/three/world-origin";

import { HexagonScene } from "./hexagon-scene";
import WorldmapScene from "./worldmap";

/** The real map centre: a contract hex and its scene hex differ by it, about 2^31. */
export const MAP_CENTER = 2147483646;

/**
 * The world map's camera, read as a player's eye: every hex the scene moves or frames the camera onto, as scene
 * (normalized) hexes. The scene's own methods run; only drawing, chunk loading and the army's own selection are left
 * out. The player's army stands on `army` (a scene hex), as the map draws it.
 */
export const worldMapCamera = (army: HexPosition) => {
  const aimed: HexPosition[] = [];
  setWorldOrigin({ col: 0, row: 0 });
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
    worldOriginLocked: false,
    camera,
    moveCameraToXYZ: (x: number, y: number, z: number) => aimed.push(WORLD_HEX_SPACE.hexForPosition({ x, y, z })),
    getArmyDisplayPosition: () => army,
    runShortcutArmySelection: async (select: () => Promise<void>) => select(),
    focusAndSelectArmy: async (entityId: number) =>
      useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: entityId } })),
    openTargetCardForSelectedArmy: (site: HexPosition) => openedCards.push(site),
  }) as {
    selectRequestedArmy: (entityId: number, forSite: unknown) => Promise<void>;
    openOnEntryDestination: () => Promise<void>;
  };
  return { aimed, openedCards, scene };
};

/** How far apart two scene hexes are, in hexes along the larger axis: enough to tell "here" from 2^30 hexes away. */
export const hexesApart = (left: HexPosition, right: HexPosition): number =>
  Math.max(Math.abs(left.col - right.col), Math.abs(left.row - right.row));
