import { X } from "@/ui/design-system/atoms/game-icons";
import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbs } from "@/ui/config";
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
import { MinimapPanel, useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel";
import { useRealtimeChatSelector } from "@/ui/features/social";
import { canIssueOrders } from "@/utils/can-issue-orders";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { HudChatWindow } from "./hud-chat-window";
import { EmpireCockpit } from "./left-facets/empire-cockpit";
import { ActionTile } from "./left-facets/structure-actions-panel";
import { StructureListColumn } from "./left-facets/structure-list-column";
import { useStructureActions } from "./left-facets/use-structure-actions";
import { resolveLeftViewSurface } from "./left-view-policy";
import { SpectatorStandingsBody } from "./spectator-standings";

type CompactTab = "empire" | "map" | "log" | "chat" | "details";

/** Tabs whose content is the bottom sheet; the log is its own popover and chat is the chat window. */
const SHEET_TABS: ReadonlySet<CompactTab> = new Set(["empire", "map", "details"]);

const COMPACT_TAB_IMAGES = {
  empire: BuildingThumbs.home,
  standings: BuildingThumbs.trophy,
  map: BuildingThumbs.worldMap,
  log: BuildingThumbs.latestUpdates,
  chat: BuildingThumbs.discord,
  details: BuildingThumbs.compass,
} as const;

/** Safe-area insets, never less than the shell's own padding so a phone without a notch keeps its gutters. */
const SAFE_BOTTOM = "max(env(safe-area-inset-bottom), 0.5rem)";
const SAFE_SIDES: CSSProperties = {
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
};

/** The shell and the landscape rails start where the header ends. */
const BELOW_HEADER = "top-[calc(max(0.5rem,env(safe-area-inset-top))+3.25rem)]";

interface LaneLayout {
  shell: string;
  panels: string;
  sheet: string;
  sheetStyle?: CSSProperties;
  tabBar: string;
  tabBarStyle: CSSProperties;
  actions: string;
  actionsStyle: CSSProperties;
}

/**
 * Portrait stacks the panels over the structure actions and a tab bar at the foot of the screen. Landscape has
 * almost no height to spare, so the same panels sit in a column docked to the right edge, the tab bar becomes a
 * vertical rail beside them, the sheet fills the column instead of taking a share of the height, and the structure
 * actions become a rail of their own on the left edge, clear of the drawers that open from the right. The rails are
 * `box-content` so the notch inset adds to their width rather than eating into the tiles.
 */
const LANE_LAYOUT: Record<CompactLane, LaneLayout> = {
  portrait: {
    shell: "inset-x-0 bottom-0 flex-col",
    panels: "",
    sheet: "max-h-[55dvh] rounded-t-xl",
    sheetStyle: SAFE_SIDES,
    tabBar: "border-t pt-1",
    tabBarStyle: { ...SAFE_SIDES, paddingBottom: SAFE_BOTTOM },
    actions: "border-t pt-1",
    actionsStyle: SAFE_SIDES,
  },
  landscape: {
    shell: `${BELOW_HEADER} bottom-0 right-0 flex-row`,
    panels: "w-[min(380px,50vw)]",
    sheet: "min-h-0 flex-1 rounded-l-xl rounded-t-none",
    tabBar: "w-16 box-content flex-col overflow-y-auto overscroll-contain border-l px-1 pt-1",
    tabBarStyle: { paddingRight: "max(env(safe-area-inset-right), 0.25rem)", paddingBottom: SAFE_BOTTOM },
    actions: `fixed left-0 bottom-0 z-30 ${BELOW_HEADER} w-16 box-content flex-col overflow-y-auto overscroll-contain border-r px-1 pt-1`,
    actionsStyle: { paddingLeft: "max(env(safe-area-inset-left), 0.25rem)", paddingBottom: SAFE_BOTTOM },
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
  const tileDetails = useSelectedTileDetails();
  const { open, navigation, toggle, close, closeAndFocusTab, setChatOpen } = useCompactPanels();
  const { rows, pinned } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, open === "log");
  const chatUnread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const logTab = useRef<HTMLButtonElement>(null);
  useConnectionNotices();

  if (showBlankOverlay) return null;

  const tabs: TabSpec[] = [
    {
      id: "empire",
      label: ordersAllowed ? "Empire" : "Standings",
      image: ordersAllowed ? COMPACT_TAB_IMAGES.empire : COMPACT_TAB_IMAGES.standings,
    },
    { id: "map", label: "Map", image: COMPACT_TAB_IMAGES.map },
    { id: "log", label: "Log", image: COMPACT_TAB_IMAGES.log, badge: unread, ref: logTab },
    { id: "chat", label: "Chat", image: COMPACT_TAB_IMAGES.chat, badge: chatUnread },
    { id: "details", label: "Details", image: COMPACT_TAB_IMAGES.details },
  ];
  const layout = LANE_LAYOUT[lane];

  return (
    <>
      {lane === "landscape" && <StructureActionStrip lane={lane} />}
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
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="min-h-0 overflow-y-auto overscroll-contain p-2 touch-pan-y">
                <SheetContent tab={open} ordersAllowed={ordersAllowed} tileDetails={tileDetails} />
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
        {lane === "portrait" && <StructureActionStrip lane={lane} />}
        <nav
          ref={navigation}
          aria-label="HUD tabs"
          className={cn(
            "pointer-events-auto flex h-auto items-stretch gap-1 border-gold/20 bg-[#101c23]",
            layout.tabBar,
          )}
          style={layout.tabBarStyle}
        >
          {tabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={open === tab.id} onToggle={toggle} />
          ))}
        </nav>
      </div>
    </>
  );
});

CompactHud.displayName = "CompactHud";

/**
 * Build · Production · Military · Transfer · Trade for the active owned structure: a row above the tab bar in
 * portrait, a rail on the left edge in landscape. Every tile opens a popover or a workspace, which
 * `useCompactPanels` already treats as replacing the sheet, so the strip needs no close logic of its own.
 */
const StructureActionStrip = ({ lane }: { lane: CompactLane }) => {
  const actions = useStructureActions();
  if (!actions) return null;
  const layout = LANE_LAYOUT[lane];
  return (
    <nav
      aria-label="Structure actions"
      className={cn("pointer-events-auto flex items-stretch gap-1 border-gold/20 bg-[#101c23]", layout.actions)}
      style={layout.actionsStyle}
    >
      {actions.map((action) => (
        <ActionTile key={action.id} variant="compact" action={action} />
      ))}
    </nav>
  );
};

interface TabSpec {
  id: CompactTab;
  label: string;
  image: string;
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
  return (
    <button
      ref={tab.ref}
      type="button"
      aria-label={tab.label}
      aria-expanded={active}
      aria-controls={active && SHEET_TABS.has(tab.id) ? "compact-hud-sheet" : undefined}
      onClick={() => onToggle(tab.id)}
      className={cn(
        "relative flex min-h-14 min-w-0 flex-1 items-center justify-center rounded-lg p-2 transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.97] active:bg-gold/15",
        active ? "bg-gold/15 text-gold" : "text-gold/75",
      )}
    >
      <img src={tab.image} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
      {tab.badge !== undefined && tab.badge > 0 && (
        <span className="absolute right-1/4 top-0">
          <UnreadFeedBadge count={tab.badge} />
        </span>
      )}
    </button>
  );
};

const SheetContent = ({
  tab,
  ordersAllowed,
  tileDetails,
}: {
  tab: CompactTab;
  ordersAllowed: boolean;
  tileDetails: ReactNode;
}) => {
  if (tab === "map") return <MinimapPanel compact />;
  if (tab === "details" && tileDetails === null)
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center font-sans text-sm text-gold/80">
        <img src={COMPACT_TAB_IMAGES.details} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        <p>Tap a tile on the map to inspect its army, structure, or terrain.</p>
      </div>
    );
  if (tab === "details") return tileDetails;
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

function useCompactPanels() {
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
    document.addEventListener("pointerdown", onMapPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onMapPointerDown, true);
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
