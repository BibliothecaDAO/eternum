import { View as LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { View as RightView } from "@/ui/modules/navigation/RightNavigationModule";
import React from "react";
import { create } from "zustand";
import { BuildModeStore, createBuildModeStoreSlice } from "./_buildModeStore";
import { createPopupsSlice, PopupsStore } from "./_popupsStore";
import { BattleViewInfo } from "./types";
import { subscribeWithSelector } from "zustand/middleware";
import { createThreeStoreSlice, ThreeStore } from "./_threeStore";
import { createRealmStoreSlice, RealmStore } from "./useRealmStore";

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
  compassDirection: number;
  setCompassDirection: (direction: number) => void;
  tooltip: {
    content: React.ReactNode;
    position: "top" | "left" | "right" | "bottom";
  } | null;
  setTooltip: (tooltip: { content: React.ReactNode; position: "top" | "left" | "right" | "bottom" } | null) => void;
  showRealmsFlags: boolean;
  setShowRealmsFlags: (show: boolean) => void;
  isLoadingScreenEnabled: boolean;
  setIsLoadingScreenEnabled: (enabled: boolean) => void;
  modalContent: React.ReactNode;
  toggleModal: (content: React.ReactNode) => void;
  showModal: boolean;
  battleView: BattleViewInfo | null;
  setBattleView: (participants: BattleViewInfo | null) => void;
  leftNavigationView: LeftView;
  setLeftNavigationView: (view: LeftView) => void;
  rightNavigationView: RightView;
  setRightNavigationView: (view: RightView) => void;
}

export type AppStore = UIStore & PopupsStore & ThreeStore & BuildModeStore & RealmStore;

const useUIStore = create(
  subscribeWithSelector<AppStore>((set, get) => ({
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
    compassDirection: 0,
    setCompassDirection: (direction) => set({ compassDirection: direction }),
    tooltip: null,
    setTooltip: (tooltip) => set({ tooltip }),
    showRealmsFlags: true,
    setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
    isLoadingScreenEnabled: true,
    setIsLoadingScreenEnabled: (enabled) => set({ isLoadingScreenEnabled: enabled }),
    modalContent: null,
    toggleModal: (content) => set({ modalContent: content, showModal: !get().showModal }),
    showModal: false,
    battleView: null,
    setBattleView: (participants: BattleViewInfo | null) => set({ battleView: participants }),
    leftNavigationView: LeftView.None,
    setLeftNavigationView: (view: LeftView) => set({ leftNavigationView: view }),
    rightNavigationView: RightView.None,
    setRightNavigationView: (view: RightView) => set({ rightNavigationView: view }),
    ...createPopupsSlice(set, get),
    ...createThreeStoreSlice(set, get),
    ...createBuildModeStoreSlice(set),
    ...createRealmStoreSlice(set),
  })),
);

export default useUIStore;
