import { BattleViewInfo, LeftView } from "@/types";
import { ContextMenuState } from "@/types/context-menu";
import { clampCycleProgress, type DebugCycleProgressOverride } from "@/utils/cycle-progress";
import { SelectableArmy } from "@bibliothecadao/eternum";
import { BiomeType, ContractAddress, Direction, StructureType } from "@bibliothecadao/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { BuildModeStore, createBuildModeStoreSlice } from "./use-build-mode-store";
import { createPopupsSlice, PopupsStore } from "./use-popups-store";
import { createRealmStoreSlice, RealmStore } from "./use-realm-store";
import { createThreeStoreSlice, ThreeStore } from "./use-three-store";
import { createWorldStoreSlice, WorldStore } from "./use-world-loading";

type TooltipPlacement = "top" | "left" | "right" | "bottom";

type BottomPanelTabId = "tile" | "minimap";

export type LeftListFilter = StructureType | "all";
export type LeftListSort = "favorites" | "level" | "population" | "name";

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

type ArmyCreationPopupConfig = {
  structureId?: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  followSelectedStructure?: boolean;
};

/**
 * Right-click "Create Defense/Attack Army" no longer opens the legacy popup —
 * it primes the merged Military modal with the target realm + intent. The
 * modal consumes and clears this on mount.
 */
type PendingMilitaryAction = {
  structureId: number;
  isExplorer: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
};

interface UIStore {
  disableButtons: boolean;
  setDisableButtons: (disable: boolean) => void;
  gameWinner: { address: ContractAddress; name: string; guildName: string } | null;
  setGameWinner: (winner: { address: ContractAddress; name: string; guildName: string } | null) => void;
  gameEndAt: number | null;
  setGameEndAt: (seasonEndAt: number | null) => void;
  gameStartMainAt: number | null;
  setGameStartMainAt: (seasonStartMainAt: number | null) => void;
  // season_config.dev_mode_on — when set, the chain bypasses settling/main-phase
  // and season-end time gates (see SeasonConfigImpl). Mirror it client-side so
  // sandbox worlds let players settle/provision/upgrade at any time.
  devModeOn: boolean;
  setDevModeOn: (devModeOn: boolean) => void;
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
  // Left rail: which structure category is shown (or "all"), and how the rows
  // are ordered. Persisted to localStorage so the player's last view sticks
  // across sessions.
  leftListFilter: LeftListFilter;
  setLeftListFilter: (filter: LeftListFilter) => void;
  leftListSort: LeftListSort;
  setLeftListSort: (sort: LeftListSort) => void;
  activeBottomPanelTab: BottomPanelTabId | null;
  setActiveBottomPanelTab: (tab: BottomPanelTabId | null) => void;
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  selectedPlayer: ContractAddress | null;
  setSelectedPlayer: (player: ContractAddress | null) => void;
  hasAcceptedTS: boolean;
  setHasAcceptedToS: (accepted: boolean) => void;
  showToS: boolean;
  setShowToS: (show: boolean) => void;
  setModal: (content: React.ReactNode | null, show: boolean) => void;
  transferPanelSourceId: number | null;
  setTransferPanelSourceId: (entityId: number | null) => void;
  // Default tab to open inside the unified Logistics view (Arrivals / Transfer /
  // Automation / All Balances). WalletPill's swap sets this to "transfer" so the
  // panel opens straight to the send flow; the sidebar pill defaults to arrivals.
  logisticsActiveTab: "arrivals" | "transfer" | "automation" | "balances";
  setLogisticsActiveTab: (tab: "arrivals" | "transfer" | "automation" | "balances") => void;
  // Cross-component signal: when a non-null id is set, the StructureEditPopup
  // (mounted inside LeftCommandSidebar) opens for that structure. The picker
  // popover writes this from the top-zone pills without needing prop-drilling.
  pendingRenameStructureEntityId: number | null;
  setPendingRenameStructureEntityId: (entityId: number | null) => void;
  // Force-refresh counter bumped after a rename writes to localStorage. Consumers
  // pass this into derivation memos so renames propagate without remounting.
  structureNameVersion: number;
  bumpStructureNameVersion: () => void;
  openArmyCreationPopup: (config: ArmyCreationPopupConfig) => void;
  pendingMilitaryAction: PendingMilitaryAction | null;
  setPendingMilitaryAction: (action: PendingMilitaryAction | null) => void;
  // Bumped whenever a military mutation lands (create / disband) so the deploy
  // map can re-fetch tile occupancy. Plain RECS-side state isn't enough — the
  militaryMapVersion: number;
  bumpMilitaryMapVersion: () => void;
  // labor
  useSimpleCost: boolean;
  setUseSimpleCost: (useSimpleCost: boolean) => void;
  // camera follow
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
  debugCycleProgressOverride: DebugCycleProgressOverride;
  setDebugCycleProgressOverride: (progress: DebugCycleProgressOverride) => void;
  cycleTime: number;
  setCycleTime: (time: number) => void;
}

export type AppStore = UIStore & PopupsStore & ThreeStore & BuildModeStore & RealmStore & WorldStore;

const readLocalBool = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === "true";
};

const readLocalInt = (key: string, fallback: number): number => {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : parseInt(v, 10);
};

const LEFT_LIST_FILTER_KEY = "leftListFilter";
const LEFT_LIST_SORT_KEY = "leftListSort";

const readLeftListFilter = (): LeftListFilter => {
  if (typeof window === "undefined") return StructureType.Realm;
  const raw = localStorage.getItem(LEFT_LIST_FILTER_KEY);
  if (raw === null) return StructureType.Realm;
  if (raw === "all") return "all";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? (parsed as StructureType) : StructureType.Realm;
};

const readLeftListSort = (): LeftListSort => {
  if (typeof window === "undefined") return "favorites";
  const raw = localStorage.getItem(LEFT_LIST_SORT_KEY);
  const options: LeftListSort[] = ["favorites", "level", "population", "name"];
  return options.includes(raw as LeftListSort) ? (raw as LeftListSort) : "favorites";
};

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
    devModeOn: false,
    setDevModeOn: (devModeOn: boolean) => set({ devModeOn }),
    showBlurOverlay: false,
    setShowBlurOverlay: (show) => set({ showBlurOverlay: show }),
    showBlankOverlay: true,
    setShowBlankOverlay: (show) => {
      set({ showBlankOverlay: show });
    },
    isSideMenuOpened: true,
    toggleSideMenu: () => set((state) => ({ isSideMenuOpened: !state.isSideMenuOpened })),
    isSoundOn: readLocalBool("soundEnabled", true),
    toggleSound: () =>
      set((state) => {
        localStorage.setItem("soundEnabled", String(!state.isSoundOn));
        return { isSoundOn: !state.isSoundOn };
      }),
    isPlaying: false,
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    musicLevel: readLocalInt("musicLevel", 50),
    setMusicLevel: (level) => {
      set({ musicLevel: level });
      localStorage.setItem("musicLevel", level.toString());
    },
    effectsLevel: readLocalInt("effectsLevel", 50),
    setEffectsLevel: (level) => {
      set({ effectsLevel: level });
      localStorage.setItem("effectsLevel", level.toString());
    },
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
    leftNavigationView: LeftView.EntityView,
    setLeftNavigationView: (view: LeftView) => set({ leftNavigationView: view, tooltip: null }),
    leftListFilter: readLeftListFilter(),
    setLeftListFilter: (filter: LeftListFilter) => {
      set({ leftListFilter: filter });
      if (typeof window !== "undefined") {
        localStorage.setItem(LEFT_LIST_FILTER_KEY, filter === "all" ? "all" : String(filter));
      }
    },
    leftListSort: readLeftListSort(),
    setLeftListSort: (sort: LeftListSort) => {
      set({ leftListSort: sort });
      if (typeof window !== "undefined") {
        localStorage.setItem(LEFT_LIST_SORT_KEY, sort);
      }
    },
    activeBottomPanelTab: "tile",
    setActiveBottomPanelTab: (tab: BottomPanelTabId | null) => set({ activeBottomPanelTab: tab }),
    showMinimap: false,
    setShowMinimap: (show: boolean) => set({ showMinimap: show }),
    selectedPlayer: null,
    setSelectedPlayer: (player: ContractAddress | null) => set({ selectedPlayer: player }),
    hasAcceptedTS: readLocalBool("hasAcceptedTS", false),
    setHasAcceptedToS: (accepted: boolean) => {
      set({ hasAcceptedTS: accepted });
      localStorage.setItem("hasAcceptedTS", String(accepted));
    },
    showToS: false,
    setShowToS: (show: boolean) => set({ showToS: show }),
    setModal: (content: React.ReactNode | null, show: boolean) =>
      set({ modalContent: content, showModal: show, tooltip: null }),
    transferPanelSourceId: null,
    setTransferPanelSourceId: (entityId: number | null) => set({ transferPanelSourceId: entityId }),
    logisticsActiveTab: "arrivals",
    setLogisticsActiveTab: (tab) => set({ logisticsActiveTab: tab }),
    pendingRenameStructureEntityId: null,
    setPendingRenameStructureEntityId: (entityId: number | null) => set({ pendingRenameStructureEntityId: entityId }),
    structureNameVersion: 0,
    bumpStructureNameVersion: () =>
      set((state: AppStore) => ({ structureNameVersion: state.structureNameVersion + 1 })),
    openArmyCreationPopup: (config: ArmyCreationPopupConfig) =>
      set((state: AppStore) => {
        const structureId = Number(config.structureId ?? state.structureEntityId);
        if (!Number.isFinite(structureId) || structureId <= 0) {
          return {};
        }

        return {
          leftNavigationView: LeftView.MilitaryView,
          pendingMilitaryAction: {
            structureId,
            isExplorer: config.isExplorer ?? true,
            direction: config.direction,
            initialGuardSlot: config.initialGuardSlot,
          },
          tooltip: null,
        };
      }),
    pendingMilitaryAction: null,
    setPendingMilitaryAction: (action: PendingMilitaryAction | null) => set({ pendingMilitaryAction: action }),
    militaryMapVersion: 0,
    bumpMilitaryMapVersion: () => set((state: AppStore) => ({ militaryMapVersion: state.militaryMapVersion + 1 })),
    ...createPopupsSlice(set, get),
    ...createThreeStoreSlice(set, get),
    ...createBuildModeStoreSlice(set),
    ...createRealmStoreSlice(set),
    ...createWorldStoreSlice(set),
    // labor
    useSimpleCost: readLocalBool("useSimpleCost", true),
    setUseSimpleCost: (useSimpleCost: boolean) => {
      set({ useSimpleCost });
      localStorage.setItem("useSimpleCost", String(useSimpleCost));
    },
    // camera follow
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
    setCycleProgress: (progress: number) => set({ cycleProgress: clampCycleProgress(progress) }),
    debugCycleProgressOverride: null,
    setDebugCycleProgressOverride: (progress: DebugCycleProgressOverride) => {
      if (progress === null) {
        set({ debugCycleProgressOverride: null });
        return;
      }

      const clampedProgress = clampCycleProgress(progress);
      set({ cycleProgress: clampedProgress, debugCycleProgressOverride: clampedProgress });
    },
    cycleTime: 0,
    setCycleTime: (time: number) => set({ cycleTime: time }),
  })),
);
