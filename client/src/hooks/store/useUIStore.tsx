import { create } from "zustand";
import { createPopupsSlice, PopupsStore } from "./_popups";
import realmsJson from "../../geodata/realms.json";
import { Vector3 } from "three";
import { createDataStoreSlice, DataStore } from "./_dataStore";
import React from "react";
export type Background = "map" | "realmView" | "combat" | "bastion";

interface UIStore {
  theme: string;
  setTheme: (theme: string) => void;
  showBlurOverlay: boolean;
  setShowBlurOverlay: (show: boolean) => void;
  isSideMenuOpened: boolean;
  toggleSideMenu: () => void;
  isSoundOn: boolean;
  toggleSound: () => void;
  musicLevel: number;
  setMusicLevel: (level: number) => void;
  effectsLevel: number;
  setEffectsLevel: (level: number) => void;
  cameraPosition: any;
  setCameraPosition: (position: any) => void;
  cameraTarget: any;
  tooltip: {
    content: React.ReactNode;
    position: "top" | "left" | "right" | "bottom";
  } | null;
  setTooltip: (tooltip: { content: React.ReactNode; position: "top" | "left" | "right" | "bottom" } | null) => void;
  mouseCoords: { x: number; y: number };
  setMouseCoords: (coords: { x: number; y: number }) => void;
  setCameraTarget: (target: any) => void;
  moveCameraToRealm: (realmId: number) => void;
  moveCameraToTarget: (target: { x: number; y: number; z: number }, distance?: number) => void;
  showRealmsFlags: boolean;
  setShowRealmsFlags: (show: boolean) => void;
  moveCameraToWorldMapView: () => void;
  moveCameraToRealmView: () => void;
  moveCameraToMarketView: () => void;
  moveCameraToCaravansView: () => void;
  moveCameraToLaborView: () => void;
  moveCameraToFoodView: () => void;
  isLoadingScreenEnabled: boolean;
  setIsLoadingScreenEnabled: (enabled: boolean) => void;
}

const useUIStore = create<UIStore & PopupsStore & DataStore>((set) => ({
  theme: "light",
  setTheme: (theme) => set({ theme }),
  showBlurOverlay: true,
  setShowBlurOverlay: (show) => set({ showBlurOverlay: show }),
  isSideMenuOpened: true,
  toggleSideMenu: () => set((state) => ({ isSideMenuOpened: !state.isSideMenuOpened })),
  isSoundOn: false,
  toggleSound: () =>
    set((state) => {
      localStorage.setItem("soundEnabled", String(!state.isSoundOn));
      return { isSoundOn: !state.isSoundOn };
    }),
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
  tooltip: null,
  setTooltip: (tooltip) => set({ tooltip }),
  mouseCoords: { x: 0, y: 0 },
  setMouseCoords: (coords) => set({ mouseCoords: coords }),
  moveCameraToRealm: (realmId) => {
    const x = realmsJson.features[realmId - 1].xy[0] * -1;
    const y = realmsJson.features[realmId - 1].xy[1] * -1;
    const targetPos = new Vector3(x, 0.7, y);
    const cameraPos = new Vector3(x + 25 * (Math.random() < 0.5 ? 1 : -1), 25, y + 25 * (Math.random() < 0.5 ? 1 : -1));
    set({ cameraPosition: cameraPos });
    set({ cameraTarget: targetPos });
  },
  moveCameraToTarget: (target, distance = 25) => {
    const cameraPos = new Vector3(
      target.x + distance * (Math.random() < 0.5 ? 1 : -1),
      distance / 2,
      target.y + distance * (Math.random() < 0.5 ? 1 : -1),
    );
    set({ cameraPosition: cameraPos });
    set({ cameraTarget: target });
  },
  showRealmsFlags: false,
  setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
  moveCameraToWorldMapView: () => {
    const pos = {
      x: -17.044911069418,
      y: 118.38408187955699,
      z: 204.31967964950695,
      transitionDuration: 0.01,
    };
    const target = {
      x: -0.26346999995776943,
      y: 0.027105,
      z: 0.007405999987503547,
      transitionDuration: 0.01,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToRealmView: () => {
    const pos = {
      x: 520.4138155171775,
      y: 1962.1390819999998,
      z: 1976.0299115304658,
      transitionDuration: 0.01,
    };
    const target = {
      x: 188.3221210638067,
      y: 0.1390819999999989,
      z: 6.35675413789002,
      transitionDuration: 0.01,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToMarketView: () => {
    const pos = {
      x: 520.4138155171775,
      y: 1962.1390819999998,
      z: 1976.0299115304658,
    };
    const target = {
      x: 188.3221210638067,
      y: 0.1390819999999989,
      z: 6.35675413789002,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToCaravansView: () => {
    const target = {
      x: 455.04897289817836,
      y: 0.1390819999999993,
      z: 126.07263921942426,
    };
    const posi = {
      x: 777.8489507984942,
      y: 346.3026168062936,
      z: 631.3327234892186,
    };
    set({ cameraPosition: posi, cameraTarget: target });
  },
  moveCameraToLaborView: () => {
    const target = {
      x: 318.9662654578011,
      y: 0.13908199999999904,
      z: -216.45294399992537,
    };
    const pos = {
      x: 612.9471476458315,
      y: 788.8605838003339,
      z: 902.2488185381396,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToFoodView: () => {
    const target = {
      x: -217.30692290462147,
      y: 0.3248529978567156,
      z: 49.85080979845691,
    };
    const pos = {
      x: 360.9134360872948,
      y: 1394.9879684979787,
      z: 1346.6607529192597,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  isLoadingScreenEnabled: true,
  setIsLoadingScreenEnabled: (enabled) => set({ isLoadingScreenEnabled: enabled }),
  ...createPopupsSlice(set),
  ...createDataStoreSlice(set),
}));

export default useUIStore;
