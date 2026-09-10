import { LeftView } from "@/types";
import { resolveLeftViewSurface } from "./left-view-policy";
import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import X from "lucide-react/dist/esm/icons/x";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import {
  FeedNotices,
  UnreadFeedBadge,
  useConnectionNotices,
  useImportantFeed,
  useUnreadFeedCount,
} from "@/ui/features/event-feed/quick-feed";
import { LocalTilePanel, MapTilePanel, MinimapPanel } from "@/ui/features/world/components/bottom-right-panel";
import { useRealtimeChatSelector } from "@/ui/features/social";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useQuery } from "@bibliothecadao/react";
import type { LucideIcon } from "lucide-react";
import Castle from "lucide-react/dist/esm/icons/castle";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import MapIcon from "lucide-react/dist/esm/icons/map";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import { type CSSProperties, memo, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { HudChatWindow } from "./hud-chat-window";
import { EmpireCockpit } from "./left-facets/empire-cockpit";
import { StructureListColumn } from "./left-facets/structure-list-column";
import { SpectatorStandingsBody } from "./spectator-standings";

type CompactTab = "empire" | "map" | "log" | "chat" | "details";

/** Tabs whose content is the bottom sheet; the log is its own popover and chat is the chat window. */
const SHEET_TABS: ReadonlySet<CompactTab> = new Set(["empire", "map", "details"]);

/** Safe-area insets, never less than the shell's own padding so a phone without a notch keeps its gutters. */
const SAFE_BOTTOM = "max(env(safe-area-inset-bottom), 0.5rem)";
const SAFE_SIDES: CSSProperties = {
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
};

interface LaneLayout {
  shell: string;
  panels: string;
  sheet: string;
  sheetStyle?: CSSProperties;
  tabBar: string;
  tabBarStyle: CSSProperties;
}

/**
 * Portrait stacks the panels over a tab bar at the foot of the screen. Landscape has almost no height to spare, so
 * the same panels sit in a column docked to the right edge, the tab bar becomes a vertical rail beside them and the
 * sheet fills the column instead of taking a share of the height. The rail is `box-content` so the notch inset adds
 * to its width rather than eating into the tabs.
 */
const LANE_LAYOUT: Record<CompactLane, LaneLayout> = {
  portrait: {
    shell: "inset-x-0 bottom-0 flex-col",
    panels: "",
    sheet: "max-h-[55dvh] rounded-t-xl",
    sheetStyle: SAFE_SIDES,
    tabBar: "border-t pt-1",
    tabBarStyle: { ...SAFE_SIDES, paddingBottom: SAFE_BOTTOM },
  },
  landscape: {
    shell: "top-[calc(max(0.5rem,env(safe-area-inset-top))+3.25rem)] bottom-0 right-0 flex-row",
    panels: "w-[min(380px,50vw)]",
    sheet: "min-h-0 flex-1 rounded-l-xl rounded-t-none",
    tabBar: "w-16 box-content flex-col overflow-y-auto overscroll-contain border-l px-1 pt-1",
    tabBarStyle: { paddingRight: "max(env(safe-area-inset-right), 0.25rem)", paddingBottom: SAFE_BOTTOM },
  },
};

/**
 * The HUD below `lg`: one tab bar and, beside it, one open panel at a time — the empire column, the minimap, the
 * log, chat, or the selected tile. The map stays tappable around whatever is open. `lane` picks the layout for the
 * phone's orientation.
 */
export const CompactHud = memo(({ lane }: { lane: CompactLane }) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const ordersAllowed = useUIStore(canIssueOrders);
  const { isMapView, selectionKey } = useTileSelection();
  const { open, navigation, toggle, close, closeAndFocusTab, setChatOpen } = useCompactPanels(selectionKey);
  const { rows, pinned } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, open === "log");
  const chatUnread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const logTab = useRef<HTMLButtonElement>(null);
  useConnectionNotices();

  if (showBlankOverlay) return null;

  const tabs: TabSpec[] = [
    { id: "empire", label: ordersAllowed ? "Empire" : "Standings", icon: Castle },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "log", label: "Log", icon: ScrollText, badge: unread, ref: logTab },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: chatUnread },
    { id: "details", label: "Details", icon: Crosshair },
  ];
  const layout = LANE_LAYOUT[lane];

  return (
    <div
      aria-label="Compact HUD"
      className={cn("pointer-events-none fixed flex", layout.shell, open === "chat" ? "z-[130]" : "z-30")}
    >
      <div className={cn("flex min-h-0 flex-col justify-end", layout.panels)}>
        <div className="flex flex-col items-end gap-1 px-2 pb-1">
          {open === null && ordersAllowed && (
            <p className="pointer-events-none self-center rounded-full bg-[#101c23] px-3 py-1.5 font-sans text-xs text-gold/85">
              Tap to select · Hold to move
            </p>
          )}
          <FeedNotices pinned={pinned} />
        </div>
        {/* The chat window stays mounted so the client keeps its connection; its strip only shows while open. */}
        <div className={open === "chat" ? "px-2 pb-1" : "hidden"}>
          <HudChatWindow open={open === "chat"} onOpenChange={setChatOpen} />
        </div>
        {open !== null && SHEET_TABS.has(open) && (
          <section
            id="compact-hud-sheet"
            aria-label="HUD sheet"
            className={cn("pointer-events-auto flex flex-col overflow-hidden", layout.sheet, OVERLAY_SURFACE_BASE)}
            style={layout.sheetStyle}
          >
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gold/20 pl-3 pr-1">
              <h2 className="font-sans text-sm font-semibold text-gold">
                {tabs.find((tab) => tab.id === open)?.label}
              </h2>
              <button
                type="button"
                aria-label="Close panel"
                onClick={closeAndFocusTab}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gold/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-2 touch-pan-y">
              <SheetContent
                tab={open}
                isMapView={isMapView}
                ordersAllowed={ordersAllowed}
                hasSelection={selectionKey !== null}
              />
            </div>
          </section>
        )}
      </div>
      {open === "log" && (
        <EventLogPanel
          onDismiss={close}
          isInsideAnchor={(target) => target instanceof Node && Boolean(logTab.current?.contains(target))}
        />
      )}
      <nav
        ref={navigation}
        aria-label="HUD tabs"
        className={cn("pointer-events-auto flex h-auto items-stretch gap-1 border-gold/20 bg-[#101c23]", layout.tabBar)}
        style={layout.tabBarStyle}
      >
        {tabs.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={open === tab.id} onToggle={toggle} />
        ))}
      </nav>
    </div>
  );
});

CompactHud.displayName = "CompactHud";

interface TabSpec {
  id: CompactTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
  ref?: RefObject<HTMLButtonElement>;
}

const TabButton = ({
  tab,
  active,
  onToggle,
}: {
  tab: TabSpec;
  active: boolean;
  onToggle: (tab: CompactTab) => void;
}) => {
  const Icon = tab.icon;
  return (
    <button
      ref={tab.ref}
      type="button"
      aria-label={tab.label}
      aria-expanded={active}
      aria-controls={active && SHEET_TABS.has(tab.id) ? "compact-hud-sheet" : undefined}
      onClick={() => onToggle(tab.id)}
      className={cn(
        "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 font-sans text-[11px] font-medium normal-case tracking-normal transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15",
        active ? "bg-gold/15 text-gold" : "text-gold/75",
      )}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="truncate">{tab.label}</span>
      {tab.badge !== undefined && (
        <span className="absolute right-1/4 top-0">
          <UnreadFeedBadge count={tab.badge} />
        </span>
      )}
    </button>
  );
};

const SheetContent = ({
  tab,
  isMapView,
  ordersAllowed,
  hasSelection,
}: {
  tab: CompactTab;
  isMapView: boolean;
  ordersAllowed: boolean;
  hasSelection: boolean;
}) => {
  if (tab === "map") return <MinimapPanel compact />;
  if (tab === "details" && !hasSelection)
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center font-sans text-sm text-gold/80">
        <Crosshair aria-hidden="true" className="h-6 w-6 text-gold" />
        <p>Tap a tile on the map to inspect its army, structure, or terrain.</p>
      </div>
    );
  if (tab === "details") return isMapView ? <MapTilePanel /> : <LocalTilePanel />;
  if (tab === "empire") return ordersAllowed ? <EmpireColumn /> : <SpectatorStandingsBody />;
  return null;
};

const EmpireColumn = () => {
  const connectedAccount = useAccountStore((state) => state.account);
  if (!connectedAccount) return null;
  return (
    <>
      <StructureListColumn />
      <EmpireCockpit />
    </>
  );
};

/**
 * Tile details follow the same rule as the desktop `BottomRightPanel`: the selected hex in map view, the selected
 * building hex in local view. The key is null with no selection and changes with every new one.
 */
const useTileSelection = () => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const selectionKey = isMapView
    ? selectedHex && `${selectedHex.col},${selectedHex.row}`
    : selectedBuildingHex &&
      [
        selectedBuildingHex.outerCol,
        selectedBuildingHex.outerRow,
        selectedBuildingHex.innerCol,
        selectedBuildingHex.innerRow,
      ].join(",");
  return { isMapView, selectionKey: selectionKey ?? null };
};

const useOpenDetailsOnNewSelection = (
  selectionKey: string | null,
  canOpen: boolean,
  open: (tab: CompactTab) => void,
) => {
  const lastSelection = useRef(selectionKey);
  useEffect(() => {
    if (canOpen && selectionKey !== null && selectionKey !== lastSelection.current) open("details");
    lastSelection.current = selectionKey;
  }, [canOpen, open, selectionKey]);
};

function useCompactPanels(selectionKey: string | null) {
  const [requested, setRequested] = useState<CompactTab | null>(null);
  const openPopoverId = usePopoverStore((state) => state.openId);
  const hasWorkspace = useUIStore(
    (state) =>
      canIssueOrders(state) &&
      (resolveLeftViewSurface(state.leftNavigationView) !== null || state.pendingRenameStructureEntityId !== null),
  );
  const hasActionSurface = openPopoverId !== null || hasWorkspace;
  const open = hasActionSurface ? null : requested;
  const navigation = useRef<HTMLElement>(null);
  useOpenDetailsOnNewSelection(selectionKey, !hasActionSurface, setRequested);

  const toggle = useCallback((tab: CompactTab) => {
    dismissActionSurfaces();
    setRequested((current) => (current === tab ? null : tab));
  }, []);
  const close = useCallback(() => setRequested(null), []);
  const closeAndFocusTab = useCallback(() => {
    navigation.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus({ preventScroll: true });
    setRequested(null);
  }, []);
  const setChatOpen = useCallback((chatOpen: boolean) => {
    if (chatOpen) dismissActionSurfaces();
    setRequested(chatOpen ? "chat" : null);
  }, []);

  useEffect(() => {
    if (hasActionSurface) setRequested(null);
  }, [hasActionSurface]);
  useEffect(() => {
    if (open === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndFocusTab();
    };
    const onMapPointerDown = (event: PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement) close();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onMapPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onMapPointerDown);
    };
  }, [open, close, closeAndFocusTab]);

  return { open, navigation, toggle, close, closeAndFocusTab, setChatOpen };
}

function dismissActionSurfaces() {
  usePopoverStore.getState().close();
  const ui = useUIStore.getState();
  ui.setLeftNavigationView(LeftView.None);
  ui.setPendingRenameStructureEntityId(null);
}
