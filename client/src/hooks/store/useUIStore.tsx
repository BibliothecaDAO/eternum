import { create } from "zustand";
import { createPopupsSlice, PopupsStore } from "./_popups";
import { Vector3 } from "three";
import { createDataStoreSlice, DataStore } from "./_dataStore";
import { createMapStoreSlice, MapStore } from "./_mapStore";
import React from "react";
import { getRealmUIPosition, getUIPositionFromColRow } from "../../ui/utils/utils";
import { BuildModeStore, createBuildModeStoreSlice } from "./_buildModeStore";
export type Background = "map" | "realmView" | "combat" | "bastion";

interface UIStore {
  theme: string;
  setTheme: (theme: string) => void;
  showBlurOverlay: boolean;
  setShowBlurOverlay: (show: boolean) => void;
  showBlankOverlay: boolean;
  setShowBlankOverlay: (show: boolean) => void;
  isSideMenuOpened: boolean;
  toggleSideMenu: () => void;
  isSoundOn: boolean;
  trackName: string;
  setTrackName: (name: string) => void;
  trackIndex: number;
  setTrackIndex: (index: number) => void;
  toggleSound: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  musicLevel: number;
  setMusicLevel: (level: number) => void;
  effectsLevel: number;
  setEffectsLevel: (level: number) => void;
  cameraPosition: any;
  setCameraPosition: (position: any) => void;
  cameraTarget: any;
  compassDirection: number;
  setCompassDirection: (direction: number) => void;
  tooltip: {
    content: React.ReactNode;
    position: "top" | "left" | "right" | "bottom";
  } | null;
  setTooltip: (tooltip: { content: React.ReactNode; position: "top" | "left" | "right" | "bottom" } | null) => void;
  mouseCoords: { x: number; y: number };
  setMouseCoords: (coords: { x: number; y: number }) => void;
  setCameraTarget: (target: any) => void;
  moveCameraToRealm: (realmId: number, speed?: number | undefined) => void;
  moveCameraToTarget: (target: { x: number; y: number; z: number }, speed?: number | undefined) => void;
  showRealmsFlags: boolean;
  setShowRealmsFlags: (show: boolean) => void;
  moveCameraToWorldMapView: () => void;
  moveCameraToRealmView: () => void;
  moveCameraToColRow: (col: number, row: number, speed?: number | undefined, transitionMode?: boolean) => void;
  isLoadingScreenEnabled: boolean;
  setIsLoadingScreenEnabled: (enabled: boolean) => void;
}

const useUIStore = create<UIStore & PopupsStore & DataStore & MapStore & BuildModeStore>((set, get) => ({
  theme: "light",
  setTheme: (theme) => set({ theme }),
  showBlurOverlay: false,
  setShowBlurOverlay: (show) => set({ showBlurOverlay: show }),
  showBlankOverlay: true,
  setShowBlankOverlay: (show) => set({ showBlankOverlay: show }),
  isSideMenuOpened: true,
  toggleSideMenu: () => set((state) => ({ isSideMenuOpened: !state.isSideMenuOpened })),
  isSoundOn: localStorage.getItem("soundEnabled") ? localStorage.getItem("soundEnabled") === "true" : true,
  trackName: "Day Break",
  setTrackName: (name) => set({ trackName: name }),
  trackIndex: 1,
  setTrackIndex: (index) => set({ trackIndex: index }),
  toggleSound: () =>
    set((state) => {
      localStorage.setItem("soundEnabled", String(!state.isSoundOn));
      return { isSoundOn: !state.isSoundOn };
    }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  musicLevel: localStorage.getItem("musicLevel") ? parseInt(localStorage.getItem("musicLevel") as string) : 50,
  setMusicLevel: (level) => {
    set({ musicLevel: level });
    localStorage.setItem("musicLevel", level.toString());
  },
  effectsLevel: localStorage.getItem("effectsLevel") ? parseInt(localStorage.getItem("effectsLevel") as string) : 50,
  setEffectsLevel: (level) => {
    set({ effectsLevel: level });
    localStorage.setItem("effectsLevel", level.toString());
  },
  cameraPosition: {
    x: -17.044911069418,
    y: 118.38408187955699,
    z: 204.31967964950695,
  },
  setCameraPosition: (position) => set({ cameraPosition: position }),
  cameraTarget: { x: 0, y: 0, z: 0 },
  setCameraTarget: (target) => set({ cameraTarget: target }),
  compassDirection: 0,
  setCompassDirection: (direction) => set({ compassDirection: direction }),
  tooltip: null,
  setTooltip: (tooltip) => set({ tooltip }),
  mouseCoords: { x: 0, y: 0 },
  setMouseCoords: (coords) => set({ mouseCoords: coords }),
  moveCameraToRealm: (realmId, speed = undefined) => {
    const pos = getRealmUIPosition(BigInt(realmId));
    const x = pos.x;
    const y = pos.y * -1;
    const targetPos = new Vector3(x, 0, y);
    const cameraPos = new Vector3(
      x + 125 * (Math.random() < 0.5 ? 1 : -1),
      100,
      y + 75 * (Math.random() < 0.5 ? 1 : -1),
    );
    set({ cameraPosition: speed ? { ...cameraPos, transitionDuration: speed } : cameraPos });
    set({ cameraTarget: speed ? { ...targetPos, transitionDuration: speed } : targetPos });
  },
  moveCameraToTarget: (target, speed = undefined) => {
    const x = target.x;
    const y = target.y * -1;
    const targetPos = new Vector3(x, 0, y);
    const cameraPos = new Vector3(
      x + 125 * (Math.random() < 0.5 ? 1 : -1),
      100,
      y + 75 * (Math.random() < 0.5 ? 1 : -1),
    );
    set({ cameraPosition: speed ? { ...cameraPos, transitionDuration: speed } : cameraPos });
    set({ cameraTarget: speed ? { ...targetPos, transitionDuration: speed } : targetPos });
  },
  showRealmsFlags: true,
  setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
  moveCameraToWorldMapView: () => {
    const pos = {
      x: 298.2009515928887,
      y: 113.9047011776059,
      z: -26.116329229297378,
      transitionDuration: 0.01,
    };
    // does not work
    const target = {
      x: 302,
      y: 20,
      z: -209,
      transitionDuration: 0.01,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToRealmView: () => {
    const pos = {
      x: 129.4417459968961,
      y: 78.04975423254507,
      z: 48.91298881770161,
      transitionDuration: 0.01,
    };
    const target = {
      x: 21.103373637682033,
      y: -0.06254476354386523,
      z: -19.36047544496302,
      transitionDuration: 0.01,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToColRow: (col: number, row: number, speed = undefined, transitionMode = false) => {
    const pos = getUIPositionFromColRow(col, row);
    const x = pos.x;
    const y = pos.y * -1;
    const targetPos = new Vector3(x, 0, y);
    let cameraPos;
    if (transitionMode) {
      cameraPos = new Vector3(x + 25, 25, y + 25); // Camera dives into exactly target position
    } else {
      cameraPos = new Vector3(x + 125 * (Math.random() < 0.5 ? 1 : -1), 100, y + 75 * (Math.random() < 0.5 ? 1 : -1));
    }
    set({ cameraPosition: speed ? { ...cameraPos, transitionDuration: speed } : cameraPos });
    set({ cameraTarget: speed ? { ...targetPos, transitionDuration: speed } : targetPos });
  },
  isLoadingScreenEnabled: true,
  setIsLoadingScreenEnabled: (enabled) => set({ isLoadingScreenEnabled: enabled }),
  ...createPopupsSlice(set, get),
  ...createDataStoreSlice(set),
  ...createMapStoreSlice(set),
  ...createBuildModeStoreSlice(set),
}));

export default useUIStore;
