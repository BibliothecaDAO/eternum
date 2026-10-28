// @vitest-environment jsdom
import { Scene } from "three";
import { expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { FLAT_TERRAIN_SURFACE } from "@/three/terrain/terrain-surface";
import WorldmapScene from "./worldmap";

/**
 * The world map's interaction runtime on a real three.js scene, as each game's map creates it and its teardown releases
 * it: the selection ring, the order's target ring and the ownership rings. Everything else the map owns stays out.
 */
const interactionRuntime = () => {
  const scene = new Scene();
  const map = Object.assign(Object.create(WorldmapScene.prototype), {
    scene,
    getTerrainSurface: () => FLAT_TERRAIN_SURFACE,
    state: useUIStore.getState(),
    game: { store: { get: () => undefined } },
    interactiveHexManager: {
      applyHoverPalette: () => {},
      setSurfaceVisibility: () => {},
      setHoverVisualMode: () => {},
    },
  }) as {
    initializeWorldmapInteractionRuntime: () => void;
    disposeWorldmapInteractionRuntime: () => void;
    selectedHexManager: { setPosition: (x: number, z: number) => void };
    orderTargetRing: { showHover: (x: number, z: number) => void };
    ownershipRings: { show: (hexes: { col: number; row: number }[]) => void };
  };
  return {
    scene,
    create: () => map.initializeWorldmapInteractionRuntime(),
    /** A game played on it: a tile selected, an order's target ringed, the player's tiles ringed. */
    play: () => {
      map.selectedHexManager.setPosition(0, 0);
      map.orderTargetRing.showHover(2, 0);
      map.ownershipRings.show([{ col: 3, row: 3 }]);
    },
    destroy: () => map.disposeWorldmapInteractionRuntime(),
  };
};

it("leaves nothing of its rings on the scene each time a game's map is torn down, the order's target ring included", () => {
  const { scene, create, play, destroy } = interactionRuntime();
  for (let game = 0; game < 3; game += 1) {
    create();
    play();
    expect(scene.children.length).toBeGreaterThan(0);
    destroy();
    expect(scene.children).toEqual([]);
  }
});
