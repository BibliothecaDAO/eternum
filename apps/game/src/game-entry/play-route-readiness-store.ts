import { create } from "zustand";

import type { PlayScene } from "@/play/navigation/play-route";

type SceneCoordinates = {
  col: number;
  row: number;
};

interface PlayRouteReadinessState {
  bootToken: number;
  hexCoordinates: SceneCoordinates | null;
  hexReady: boolean;
  markHexReady: (token: number, coords?: SceneCoordinates | null) => void;
  /** A scene the boot waits on failed to set up: the boot ends in its error state instead of waiting on. */
  markSceneFailed: (token: number, scene: PlayScene, error: Error) => void;
  /** The map could not be drawn and the player opens their realm instead: the boot goes on without the map. */
  openRealmWithoutMap: (token: number) => void;
  mapSkipped: boolean;
  markWorldmapConverged: (token: number) => void;
  markWorldmapReady: (token: number) => void;
  reset: (token: number) => void;
  sceneFailure: { scene: PlayScene; error: Error } | null;
  worldmapConverged: boolean;
  worldmapReady: boolean;
}

export const usePlayRouteReadinessStore = create<PlayRouteReadinessState>((set) => ({
  bootToken: 0,
  hexCoordinates: null,
  hexReady: false,
  markHexReady: (token, coords = null) =>
    set((state) => {
      if (token !== state.bootToken) {
        return state;
      }

      return {
        hexCoordinates: coords,
        hexReady: true,
      };
    }),
  markSceneFailed: (token, scene, error) =>
    set((state) => (token === state.bootToken ? { sceneFailure: { scene, error } } : state)),
  openRealmWithoutMap: (token) =>
    set((state) => (token === state.bootToken ? { mapSkipped: true, sceneFailure: null } : state)),
  mapSkipped: false,
  markWorldmapReady: (token) =>
    set((state) => {
      if (token !== state.bootToken) {
        return state;
      }

      return {
        worldmapReady: true,
        // A map that opens after having failed is no longer a map that could not be drawn.
        sceneFailure: state.sceneFailure?.scene === "map" ? null : state.sceneFailure,
      };
    }),
  markWorldmapConverged: (token) =>
    set((state) => {
      if (token !== state.bootToken) {
        return state;
      }

      return {
        worldmapConverged: true,
      };
    }),
  reset: (token) =>
    set({
      bootToken: token,
      hexCoordinates: null,
      hexReady: false,
      mapSkipped: false,
      sceneFailure: null,
      worldmapConverged: false,
      worldmapReady: false,
    }),
  sceneFailure: null,
  worldmapConverged: false,
  worldmapReady: false,
}));

export const getCurrentPlayRouteBootToken = () => usePlayRouteReadinessStore.getState().bootToken;
