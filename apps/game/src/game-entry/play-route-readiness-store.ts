import { create } from "zustand";

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
  markSceneFailed: (token: number, error: Error) => void;
  markWorldmapConverged: (token: number) => void;
  markWorldmapReady: (token: number) => void;
  reset: (token: number) => void;
  sceneFailure: Error | null;
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
  markSceneFailed: (token, error) => set((state) => (token === state.bootToken ? { sceneFailure: error } : state)),
  markWorldmapReady: (token) =>
    set((state) => {
      if (token !== state.bootToken) {
        return state;
      }

      return {
        worldmapReady: true,
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
      sceneFailure: null,
      worldmapConverged: false,
      worldmapReady: false,
    }),
  sceneFailure: null,
  worldmapConverged: false,
  worldmapReady: false,
}));

export const getCurrentPlayRouteBootToken = () => usePlayRouteReadinessStore.getState().bootToken;
