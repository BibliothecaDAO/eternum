import { create } from "zustand";
import { createPopupsSlice, PopupsStore } from "./_popups";
import { Vector3 } from "three";
import { createDataStoreSlice, DataStore } from "./_dataStore";
import React from "react";
import { getRealmUIPosition } from "../../utils/utils";
import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { Hexagon } from "../../components/worldmap/HexGrid";
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
  clickedHex: { col: number; row: number; hexIndex: number } | undefined;
  setClickedHex: (hex: { col: number; row: number; hexIndex: number } | undefined) => void;
  setClickedHyperstructure: (hyperstructure: HyperStructureInterface | undefined) => void;
  clickedHyperstructure: HyperStructureInterface | undefined;
  hexData: Hexagon[] | undefined;
  setHexData: (hexData: Hexagon[]) => void;
}

const useUIStore = create<UIStore & PopupsStore & DataStore>((set) => ({
  theme: "light",
  setTheme: (theme) => set({ theme }),
  showBlurOverlay: false,
  setShowBlurOverlay: (show) => set({ showBlurOverlay: show }),
  showBlankOverlay: true,
  setShowBlankOverlay: (show) => set({ showBlankOverlay: show }),
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
    const pos = getRealmUIPosition(BigInt(realmId));
    const x = pos.x;
    const y = pos.y * -1;
    const targetPos = new Vector3(x, 0, y);
    const cameraPos = new Vector3(
      x + 125 * (Math.random() < 0.5 ? 1 : -1),
      100,
      y + 75 * (Math.random() < 0.5 ? 1 : -1),
    );
    set({ cameraPosition: cameraPos });
    set({ cameraTarget: targetPos });
  },
  moveCameraToTarget: (target, distance = 25) => {
    const x = target.x;
    const y = target.y * -1;
    const z = target.z;
    const trueTarget = { x, y, z };
    const cameraPos = new Vector3(
      x + distance * (Math.random() < 0.5 ? 1 : -1),
      distance / 2,
      y + distance * (Math.random() < 0.5 ? 1 : -1),
    );
    set({ cameraPosition: cameraPos });
    set({ cameraTarget: trueTarget });
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
      x: 520.4138155171775,
      y: 1084.1390819999998,
      z: 1357.0299115304658,
      transitionDuration: 0.01,
    };
    const target = {
      x: 40.3221210638067,
      y: 0.1390819999999989,
      z: -33.35675413789002,
      transitionDuration: 0.01,
    };
    set({ cameraPosition: pos, cameraTarget: target });
  },
  moveCameraToMarketView: () => {
    const pos = {
      x: 520.4138155171775,
      y: 500.1390819999998,
      z: 1357.0299115304658,
    };
    const target = {
      x: 40.3221210638067,
      y: 0.1390819999999989,
      z: -33.35675413789002,
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
  clickedHex: undefined,
  setClickedHex: (hex) => {
    set({ clickedHex: hex });
  },
  setClickedHyperstructure: (hyperstructure) => set({ clickedHyperstructure: hyperstructure }),
  clickedHyperstructure: undefined,
  hexData: undefined,
  setHexData: (hexData) => {
    set({ hexData });
  },
}));

export default useUIStore;
