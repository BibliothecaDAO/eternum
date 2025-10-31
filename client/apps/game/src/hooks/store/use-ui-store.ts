import { BattleViewInfo, LeftView, RightView } from "@/types";
import { ContextMenuState } from "@/types/context-menu";
import { SelectableArmy } from "@bibliothecadao/eternum";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { BuildModeStore, createBuildModeStoreSlice } from "./use-build-mode-store";
import { createPopupsSlice, PopupsStore } from "./use-popups-store";
import { createRealmStoreSlice, RealmStore } from "./use-realm-store";
import { createThreeStoreSlice, ThreeStore } from "./use-three-store";
import { createWorldStoreSlice, WorldStore } from "./use-world-loading";

type TooltipPlacement = "top" | "left" | "right" | "bottom";

let lastResolvedAnchor: HTMLElement | null = null;

const isInDocument = (element: HTMLElement | null) => {
  if (!element) {
    return false;
  }

  return document.contains(element);
};

const INTERACTIVE_SELECTOR = "[data-tooltip-anchor], button, [role='button'], a, [data-radix-collection-item]";

const getFallbackAnchor = (existing?: HTMLElement | null): HTMLElement | null => {
  if (existing) {
    lastResolvedAnchor = existing;
    return existing;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const hovered = document.querySelectorAll(":hover");
  const lastHovered = hovered.length ? (hovered[hovered.length - 1] as HTMLElement) : null;
  const tooltipElement = document.getElementById("tooltip-root");

  if (lastHovered && tooltipElement && tooltipElement.contains(lastHovered)) {
    return null;
  }

  if (lastHovered) {
    const interactiveAncestor = lastHovered.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;

    if (interactiveAncestor) {
      lastResolvedAnchor = interactiveAncestor;
      return interactiveAncestor;
    }

    lastResolvedAnchor = lastHovered;
    return lastHovered;
  }

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (active) {
    const anchorCandidate = active.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (anchorCandidate) {
      lastResolvedAnchor = anchorCandidate;
      return anchorCandidate;
    }
    lastResolvedAnchor = active;
    return active;
  }

  if (isInDocument(lastResolvedAnchor)) {
    return lastResolvedAnchor;
  }

  lastResolvedAnchor = null;

  return null;
};

type TooltipType = {
  content: React.ReactNode;
  position?: TooltipPlacement;
  anchorElement?: HTMLElement | null;
  fixed?: {
    x: number;
    y: number;
  };
} | null;

interface UIStore {
  disableButtons: boolean;
  setDisableButtons: (disable: boolean) => void;
  gameWinner: { address: ContractAddress; name: string; guildName: string } | null;
  setGameWinner: (winner: { address: ContractAddress; name: string; guildName: string } | null) => void;
  gameEndAt: number | null;
  setGameEndAt: (seasonEndAt: number | null) => void;
  gameStartMainAt: number | null;
  setGameStartMainAt: (seasonStartMainAt: number | null) => void;
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
  contextMenu: ContextMenuState | null;
  contextMenuStack: ContextMenuState[];
  openContextMenu: (menu: ContextMenuState) => void;
  pushContextMenu: (menu: ContextMenuState) => void;
  popContextMenu: () => void;
  closeContextMenu: () => void;
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
  hasAcceptedTS: boolean;
  setHasAcceptedToS: (accepted: boolean) => void;
  showToS: boolean;
  setShowToS: (show: boolean) => void;
  setModal: (content: React.ReactNode | null, show: boolean) => void;
  // labor
  useSimpleCost: boolean;
  setUseSimpleCost: (useSimpleCost: boolean) => void;
  // camera follow
  followArmyMoves: boolean;
  setFollowArmyMoves: (follow: boolean) => void;
  followArmyCombats: boolean;
  setFollowArmyCombats: (follow: boolean) => void;
  isFollowingArmy: boolean;
  setIsFollowingArmy: (following: boolean) => void;
  followingArmyMessage: string | null;
  setFollowingArmyMessage: (message: string | null) => void;
  // shortcut navigation
  selectableArmies: SelectableArmy[];
  setSelectableArmies: (armies: SelectableArmy[]) => void;
  // cycle timing for storm effects
  cycleProgress: number;
  setCycleProgress: (progress: number) => void;
  cycleTime: number;
  setCycleTime: (time: number) => void;
  // map zoom controls
  enableMapZoom: boolean;
  setEnableMapZoom: (enable: boolean) => void;
}

export type AppStore = UIStore & PopupsStore & ThreeStore & BuildModeStore & RealmStore & WorldStore;

export const useUIStore = create(
  subscribeWithSelector<AppStore>((set, get) => ({
    disableButtons: false,
    setDisableButtons: (disable: boolean) => set({ disableButtons: disable }),
    gameWinner: null,
    setGameWinner: (winner: { address: ContractAddress; name: string; guildName: string } | null) =>
      set({ gameWinner: winner }),
    gameEndAt: null,
    setGameEndAt: (seasonEndAt: number | null) => set({ gameEndAt: seasonEndAt }),
    gameStartMainAt: null,
    setGameStartMainAt: (seasonStartMainAt: number | null) => set({ gameStartMainAt: seasonStartMainAt }),
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
    setTooltip: (tooltip) =>
      set({
        tooltip:
          tooltip && !tooltip.fixed
            ? {
                ...tooltip,
                anchorElement: getFallbackAnchor(tooltip.anchorElement ?? undefined),
              }
            : tooltip,
      }),
    contextMenu: null,
    contextMenuStack: [],
    openContextMenu: (menu: ContextMenuState) => set({ contextMenu: menu, contextMenuStack: [] }),
    pushContextMenu: (menu: ContextMenuState) =>
      set((state) => {
        const stack = state.contextMenu ? [...state.contextMenuStack, state.contextMenu] : state.contextMenuStack;
        return { contextMenu: menu, contextMenuStack: stack };
      }),
    popContextMenu: () =>
      set((state) => {
        const stack = [...state.contextMenuStack];
        const previous = stack.pop() ?? null;
        return { contextMenu: previous, contextMenuStack: stack };
      }),
    closeContextMenu: () => set({ contextMenu: null, contextMenuStack: [] }),
    showRealmsFlags: true,
    setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
    isLoadingScreenEnabled: true,
    setIsLoadingScreenEnabled: (enabled) => set({ isLoadingScreenEnabled: enabled }),
    modalContent: null,
    toggleModal: (content) => {
      set({ modalContent: content, showModal: !!content, tooltip: null });
    },
    showModal: false,
    battleView: null,
    setBattleView: (participants: BattleViewInfo | null) => set({ battleView: participants }),
    leftNavigationView: LeftView.None,
    setLeftNavigationView: (view: LeftView) => set({ leftNavigationView: view, tooltip: null }),
    rightNavigationView: RightView.None,
    setRightNavigationView: (view: RightView) => set({ rightNavigationView: view, tooltip: null }),
    showMinimap: false,
    setShowMinimap: (show: boolean) => set({ showMinimap: show }),
    selectedPlayer: null,
    setSelectedPlayer: (player: ContractAddress | null) => set({ selectedPlayer: player }),
    hasAcceptedTS: localStorage.getItem("hasAcceptedTS") ? localStorage.getItem("hasAcceptedTS") === "true" : false,
    setHasAcceptedToS: (accepted: boolean) => {
      set({ hasAcceptedTS: accepted });
      localStorage.setItem("hasAcceptedTS", String(accepted));
    },
    showToS: false,
    setShowToS: (show: boolean) => set({ showToS: show }),
    setModal: (content: React.ReactNode | null, show: boolean) =>
      set({ modalContent: content, showModal: show, tooltip: null }),
    ...createPopupsSlice(set, get),
    ...createThreeStoreSlice(set, get),
    ...createBuildModeStoreSlice(set),
    ...createRealmStoreSlice(set),
    ...createWorldStoreSlice(set),
    // labor
    useSimpleCost: true,
    setUseSimpleCost: (useSimpleCost: boolean) => set({ useSimpleCost }),
    // camera follow
    followArmyMoves: false,
    setFollowArmyMoves: (follow: boolean) => {
      set({ followArmyMoves: follow });
    },
    followArmyCombats: false,
    setFollowArmyCombats: (follow: boolean) => {
      set({ followArmyCombats: follow });
    },
    isFollowingArmy: false,
    setIsFollowingArmy: (following: boolean) => {
      set({ isFollowingArmy: following });
    },
    followingArmyMessage: null,
    setFollowingArmyMessage: (message: string | null) => {
      set({ followingArmyMessage: message });
    },
    // shortcut navigation - dummy data for now
    selectableArmies: [],
    setSelectableArmies: (armies: SelectableArmy[]) => set({ selectableArmies: armies }),
    // cycle timing for storm effects
    cycleProgress: 0,
    setCycleProgress: (progress: number) => set({ cycleProgress: progress }),
    cycleTime: 0,
    setCycleTime: (time: number) => set({ cycleTime: time }),
    // map zoom controls - disabled by default for better UX
    enableMapZoom: localStorage.getItem("enableMapZoom") ? localStorage.getItem("enableMapZoom") === "true" : false,
    setEnableMapZoom: (enable: boolean) => {
      set({ enableMapZoom: enable });
      localStorage.setItem("enableMapZoom", String(enable));
    },
  })),
);
