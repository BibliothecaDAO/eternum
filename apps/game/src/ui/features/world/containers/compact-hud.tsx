import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
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
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { HudChatWindow } from "./hud-chat-window";
import { EmpireCockpit } from "./left-facets/empire-cockpit";
import { StructureListColumn } from "./left-facets/structure-list-column";
import { SpectatorStandingsBody } from "./spectator-standings";

type CompactTab = "empire" | "map" | "log" | "chat" | "details";

/** Tabs whose content is the bottom sheet; the log is its own popover and chat is the chat window. */
const SHEET_TABS: ReadonlySet<CompactTab> = new Set(["empire", "map", "details"]);

const TAB_BAR_SAFE_PADDING = "max(env(safe-area-inset-bottom), 0.5rem)";

/**
 * The HUD below `lg`: one tab bar at the foot of the screen and, above it, one open panel at a time — the empire
 * column, the minimap, the log, chat, or the selected tile. The map stays tappable around whatever is open.
 */
export const CompactHud = memo(() => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const ordersAllowed = useUIStore(canIssueOrders);
  const { isMapView, selectionKey } = useTileSelection();
  const [requested, setRequested] = useState<CompactTab | null>(null);
  const open = requested === "details" && selectionKey === null ? null : requested;
  const { rows, pinned } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, open === "log");
  const chatUnread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const logTab = useRef<HTMLButtonElement>(null);
  useConnectionNotices();
  useOpenDetailsOnNewSelection(selectionKey, setRequested);

  const toggle = useCallback((tab: CompactTab) => setRequested((current) => (current === tab ? null : tab)), []);
  const close = useCallback(() => setRequested(null), []);
  const setChatOpen = useCallback((chatOpen: boolean) => setRequested(chatOpen ? "chat" : null), []);

  if (showBlankOverlay) return null;

  const tabs: TabSpec[] = [
    { id: "empire", label: ordersAllowed ? "Empire" : "Standings", icon: Castle },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "log", label: "Log", icon: ScrollText, badge: unread, ref: logTab },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: chatUnread },
  ];
  if (selectionKey !== null) tabs.push({ id: "details", label: "Details", icon: Crosshair });

  return (
    <div
      aria-label="Compact HUD"
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 flex flex-col", open === "chat" ? "z-[130]" : "z-30")}
    >
      <div className="flex flex-col items-end gap-1 px-2 pb-1">
        <FeedNotices pinned={pinned} />
      </div>
      {/* The chat window stays mounted so the client keeps its connection; its strip only shows while open. */}
      <div className={open === "chat" ? "px-2 pb-1" : "hidden"}>
        <HudChatWindow open={open === "chat"} onOpenChange={setChatOpen} />
      </div>
      {open !== null && SHEET_TABS.has(open) && (
        <section
          aria-label="HUD sheet"
          className={cn(
            "pointer-events-auto flex max-h-[55dvh] flex-col gap-2 overflow-y-auto overscroll-contain rounded-t-xl p-2 touch-pan-y",
            OVERLAY_SURFACE_BASE,
          )}
        >
          <SheetContent tab={open} isMapView={isMapView} ordersAllowed={ordersAllowed} />
        </section>
      )}
      {open === "log" && (
        <EventLogPanel
          onDismiss={close}
          isInsideAnchor={(target) => target instanceof Node && Boolean(logTab.current?.contains(target))}
        />
      )}
      <nav
        aria-label="HUD tabs"
        className="pointer-events-auto flex h-auto items-stretch gap-1 border-t border-gold/20 bg-black/90 px-2 pt-1 backdrop-blur-md"
        style={{ paddingBottom: TAB_BAR_SAFE_PADDING }}
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
      onClick={() => onToggle(tab.id)}
      className={cn(
        "relative flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg font-sans transition-all duration-200 active:scale-95",
        HUD_LABEL,
        active ? "text-gold" : "text-gold/50",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{tab.label}</span>
      {tab.badge !== undefined && (
        <span className="absolute right-1/4 top-0">
          <UnreadFeedBadge count={tab.badge} />
        </span>
      )}
      {active && (
        <span className="absolute -bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_6px_rgba(223,170,84,0.8)]" />
      )}
    </button>
  );
};

const SheetContent = ({
  tab,
  isMapView,
  ordersAllowed,
}: {
  tab: CompactTab;
  isMapView: boolean;
  ordersAllowed: boolean;
}) => {
  if (tab === "map") return <MinimapPanel />;
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

const useOpenDetailsOnNewSelection = (selectionKey: string | null, open: (tab: CompactTab) => void) => {
  const lastSelection = useRef(selectionKey);
  useEffect(() => {
    if (selectionKey !== null && selectionKey !== lastSelection.current) open("details");
    lastSelection.current = selectionKey;
  }, [open, selectionKey]);
};
