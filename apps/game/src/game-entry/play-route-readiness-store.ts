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
  /** Starts a boot and returns its token: each is newer than every boot before it on this page, mounted or not. */
  startBoot: () => number;
  sceneFailure: { scene: PlayScene; error: Error } | null;
  worldmapConverged: boolean;
  worldmapReady: boolean;
}

export const usePlayRouteReadinessStore = create<PlayRouteReadinessState>((set, get) => ({
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
  startBoot: () => {
    const token = get().bootToken + 1;
    set({
      bootToken: token,
      hexCoordinates: null,
      hexReady: false,
      mapSkipped: false,
      sceneFailure: null,
      worldmapConverged: false,
      worldmapReady: false,
    });
    return token;
  },
  sceneFailure: null,
  worldmapConverged: false,
  worldmapReady: false,
}));

export const getCurrentPlayRouteBootToken = () => usePlayRouteReadinessStore.getState().bootToken;

/**
 * Calls back with each boot that starts from now on. A scene already set up when a boot starts (a return to the match,
 * a spectator who presses Play) has no setup to come that would announce it, so it answers the boot from here.
 */
export const onPlayRouteBootStarted = (listener: () => void): (() => void) =>
  usePlayRouteReadinessStore.subscribe((next, previous) => {
    if (next.bootToken !== previous.bootToken) listener();
  });
