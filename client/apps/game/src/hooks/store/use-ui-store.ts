import { BattleViewInfo, LeftView, RightView } from "@/types";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { tracks } from "../helpers/use-music";
import { BuildModeStore, createBuildModeStoreSlice } from "./_build-mode-store";
import { createPopupsSlice, PopupsStore } from "./_popups-store";
import { createThreeStoreSlice, ThreeStore } from "./_three-store";
import { createRealmStoreSlice, RealmStore } from "./use-realm-store";
import { createWorldStoreSlice, WorldStore } from "./use-world-loading";

type TooltipType = {
  content: React.ReactNode;
  position?: "top" | "left" | "right" | "bottom";
  fixed?: {
    x: number;
    y: number;
  };
} | null;

interface UIStore {
  disableButtons: boolean;
  setDisableButtons: (disable: boolean) => void;
  spectatorRealmEntityId: ID | null;
  setSpectatorRealmEntityId: (entityId: ID | null) => void;
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
  tooltip: TooltipType;
  setTooltip: (tooltip: TooltipType) => void;
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
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  selectedPlayer: ContractAddress | null;
  setSelectedPlayer: (player: ContractAddress | null) => void;
  hasAcceptedToS: boolean;
  setHasAcceptedToS: (accepted: boolean) => void;
  showToS: boolean;
  setShowToS: (show: boolean) => void;
  setModal: (content: React.ReactNode | null, show: boolean) => void;
  // labor
  useSimpleCost: boolean;
  setUseSimpleCost: (useSimpleCost: boolean) => void;
}

export type AppStore = UIStore & PopupsStore & ThreeStore & BuildModeStore & RealmStore & WorldStore;

const initialTrackIndex = Math.floor(Math.random() * tracks.length);

export const useUIStore = create(
  subscribeWithSelector<AppStore>((set, get) => ({
    disableButtons: false,
    setDisableButtons: (disable: boolean) => set({ disableButtons: disable }),
    spectatorRealmEntityId: null,
    setSpectatorRealmEntityId: (entityId: ID | null) => set({ spectatorRealmEntityId: entityId }),
    theme: "light",
    setTheme: (theme) => set({ theme }),
    showBlurOverlay: false,
    setShowBlurOverlay: (show) => set({ showBlurOverlay: show }),
    showBlankOverlay: true,
    setShowBlankOverlay: (show) => {
      set({ showBlankOverlay: show });
    },
    isSideMenuOpened: true,
    toggleSideMenu: () => set((state) => ({ isSideMenuOpened: !state.isSideMenuOpened })),
    isSoundOn: localStorage.getItem("soundEnabled") ? localStorage.getItem("soundEnabled") === "true" : true,
    trackName: tracks[initialTrackIndex].name,
    setTrackName: (name) => set({ trackName: name }),
    trackIndex: initialTrackIndex,
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
    showMinimap: false,
    setShowMinimap: (show: boolean) => set({ showMinimap: show }),
    selectedPlayer: null,
    setSelectedPlayer: (player: ContractAddress | null) => set({ selectedPlayer: player }),
    hasAcceptedToS: localStorage.getItem("hasAcceptedToS") ? localStorage.getItem("hasAcceptedToS") === "true" : false,
    setHasAcceptedToS: (accepted: boolean) => {
      set({ hasAcceptedToS: accepted });
      localStorage.setItem("hasAcceptedToS", String(accepted));
    },
    showToS: false,
    setShowToS: (show: boolean) => set({ showToS: show }),
    setModal: (content: React.ReactNode | null, show: boolean) => set({ modalContent: content, showModal: show }),
    ...createPopupsSlice(set, get),
    ...createThreeStoreSlice(set, get),
    ...createBuildModeStoreSlice(set),
    ...createRealmStoreSlice(set),
    ...createWorldStoreSlice(set),
    // labor
    useSimpleCost: true,
    setUseSimpleCost: (useSimpleCost: boolean) => set({ useSimpleCost }),
  })),
);
