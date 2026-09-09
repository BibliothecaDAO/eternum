import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { configManager, Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { TickIds } from "@bibliothecadao/types";
import type { LucideIcon } from "lucide-react";
import Castle from "lucide-react/dist/esm/icons/castle";
import Check from "lucide-react/dist/esm/icons/check";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Crown from "lucide-react/dist/esm/icons/crown";
import Hourglass from "lucide-react/dist/esm/icons/hourglass";
import Info from "lucide-react/dist/esm/icons/info";
import Package from "lucide-react/dist/esm/icons/package";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import Skull from "lucide-react/dist/esm/icons/skull";
import Swords from "lucide-react/dist/esm/icons/swords";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import type { HeadlineType } from "../news-headlines/headline-types";
import {
  extractRoleLabel,
  findSegmentValue,
  formatWinnerName,
  parsePresentationDescription,
} from "../story-events/story-event-utils";
import { transferRowLabel } from "./event-feed-rows";
import { EventLogPanel } from "./event-log-panel";
import { toast } from "./notify";
import {
  type ImportantFeedRow,
  resolveGameTick,
  selectImportantFeedRows,
  selectQuickFeedRows,
} from "./important-feed-rows";
import { resolveStoryEventPosition } from "./story-feed-row";
import { useFeedRows } from "./use-feed-rows";

const QUICK_FEED_WINDOW_MS = 20_000;
const QUICK_FEED_MAX_ROWS = 5;
const QUICK_FEED_FADE_MS = 3_000;
const CONNECTION_NOTICE_ID = "connection";

const ROW_CLASS = "flex h-7 w-full items-center gap-2 rounded-md bg-black/45 px-2 text-[11px] text-gold backdrop-blur-[2px]";

/** What just happened, top-right under the header: at most five one-line rows that fade, then a Log button. */
export const QuickFeed = () => {
  const nowMs = useNowMs();
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const startAt = useUIStore((state) => state.gameStartMainAt);
  const address = useAccountStore((state) => state.account?.address ?? null);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, nowMs, tickSeconds);
  const { data: stories } = useStoryEvents(350, "BattleStory");
  const feed = useFeedRows();
  const rows = selectImportantFeedRows(stories, feed, "all", address, headlineFeed.recent);
  const visible = selectQuickFeedRows(rows, nowMs, QUICK_FEED_WINDOW_MS, QUICK_FEED_MAX_ROWS);
  const [logOpen, setLogOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const logButton = useRef<HTMLButtonElement>(null);
  const unread = logOpen ? 0 : rows.filter((row) => row.at > seenAt).length;
  useConnectionNotices();

  const toggleLog = () => {
    setSeenAt(Date.now());
    setLogOpen((open) => !open);
  };

  return (
    <div aria-label="Quick feed" className="flex flex-col items-end gap-1">
      <OfflineRow />
      {headlineFeed.pinned.map((headline) => (
        <div key={headline.id} aria-label="Pinned event" className={cn(ROW_CLASS, "bg-gold/20")}>
          <HeadlineIcon type={headline.type} />
          <span className="min-w-0 flex-1 truncate">{headline.description}</span>
        </div>
      ))}
      {visible.map((row) => (
        <QuickFeedRow
          key={row.id}
          row={row}
          tick={resolveGameTick(row.at, startAt, tickSeconds)}
          opacity={Math.min(1, (QUICK_FEED_WINDOW_MS - (nowMs - row.at)) / QUICK_FEED_FADE_MS)}
        />
      ))}
      <button
        ref={logButton}
        type="button"
        aria-label="Log"
        aria-expanded={logOpen}
        onClick={toggleLog}
        className={cn(
          "pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-black/45 px-2 font-sans backdrop-blur-[2px] hover:bg-black/60",
          HUD_LABEL,
        )}
      >
        <ScrollText className="h-3.5 w-3.5" />
        Log
        {unread > 0 && (
          <span aria-label="Unread events" className="rounded-full bg-gold px-1.5 text-[10px] text-dark-brown">
            {unread}
          </span>
        )}
      </button>
      {logOpen && (
        <EventLogPanel
          onDismiss={toggleLog}
          isInsideAnchor={(target) => target instanceof Node && Boolean(logButton.current?.contains(target))}
        />
      )}
    </div>
  );
};

/** Connection transitions become feed rows; the offline state is the pinned red row above. */
function useConnectionNotices() {
  useEffect(
    () =>
      useConnectionStore.subscribe((state, previous) => {
        if (state.status === previous.status) return;
        if (state.status === "connected") toast.success("Back online", { id: CONNECTION_NOTICE_ID });
        else if (state.status === "degraded") toast.warning("Reconnecting…", { id: CONNECTION_NOTICE_ID });
        else toast.dismiss(CONNECTION_NOTICE_ID);
      }),
    [],
  );
}

function OfflineRow() {
  const status = useConnectionStore((state) => state.status);
  const reconnecting = useConnectionStore(
    (state) => state.spatialStatus === "reconnecting" || state.globalStatus === "reconnecting",
  );
  if (status !== "disconnected") return null;
  return (
    <div aria-label="Offline" className={cn(ROW_CLASS, "pointer-events-auto bg-danger/30 text-danger")}>
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Offline</span>
      <button
        type="button"
        disabled={reconnecting}
        onClick={() => void triggerConnectionForceReconnect()}
        className="inline-flex items-center gap-1 font-sans text-[11px] normal-case tracking-normal text-danger hover:underline disabled:cursor-wait"
      >
        <RefreshCw className={cn("h-3 w-3", reconnecting && "animate-spin")} />
        Retry
      </button>
    </div>
  );
}

const HEADLINE_ICONS: Record<HeadlineType, LucideIcon> = {
  "realm-fall": Castle,
  "hyper-capture": Crown,
  elimination: Skull,
  "game-start": Crown,
  "game-end": Trophy,
  "five-min-warning": Clock3,
  "t3-building": Shield,
};

const HeadlineIcon = ({ type }: { type: HeadlineType }) => {
  const Icon = HEADLINE_ICONS[type];
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
};

const QuickFeedRow = ({ row, tick, opacity }: { row: ImportantFeedRow; tick: number; opacity: number }) => {
  const target = useFeedRowTarget(row);
  const navigate = useNavigateToMapView();
  const { icon, text } = summarizeFeedRow(row);
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{text}</span>
      <span className="shrink-0 tabular-nums text-gold/50">T{tick}</span>
    </>
  );
  if (!target) {
    return (
      <div className={ROW_CLASS} style={{ opacity }}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className={cn(ROW_CLASS, "pointer-events-auto font-sans normal-case tracking-normal hover:bg-black/65")}
      style={{ opacity }}
    >
      {content}
    </button>
  );
};

function useFeedRowTarget(row: ImportantFeedRow): Position | null {
  const {
    setup: { components },
  } = useDojo();
  const structure = useWorldSlicesStore((state) =>
    row.kind === "arrival" ? state.structures.find((entry) => entry.entity_id === row.structureEntityId) : undefined,
  );
  if (row.kind === "headline") {
    return row.headline.location ? new Position({ x: row.headline.location.x, y: row.headline.location.y }) : null;
  }
  if (row.kind === "story") return resolveStoryEventPosition(row.event, components);
  if (row.kind === "arrival") {
    return structure ? new Position({ x: structure.base.coord_x, y: structure.base.coord_y }) : null;
  }
  return null;
}

function summarizeFeedRow(row: ImportantFeedRow): { icon: ReactNode; text: ReactNode } {
  if (row.kind === "headline") {
    return { icon: <HeadlineIcon type={row.headline.type} />, text: row.headline.description };
  }
  if (row.kind === "story") return { icon: <Swords className="h-3.5 w-3.5 shrink-0" />, text: summarizeStory(row) };
  if (row.kind === "arrival") {
    return { icon: <Package className="h-3.5 w-3.5 shrink-0" />, text: `${transferRowLabel(row)} · #${row.structureEntityId}` };
  }
  if (row.kind === "transaction") {
    const { transaction, isStuck } = row;
    const failed = transaction.status === "reverted";
    const status = isStuck ? "Stuck" : failed ? "Failed" : transaction.status === "success" ? "Done" : "Pending";
    const Icon = isStuck || failed ? TriangleAlert : transaction.status === "success" ? Check : Hourglass;
    return {
      icon: <Icon className={cn("h-3.5 w-3.5 shrink-0", (isStuck || failed) && "text-danger")} />,
      text: `${transferRowLabel(row) ?? transaction.description} · ${status}`,
    };
  }
  const Icon = row.notice.kind === "error" || row.notice.kind === "warning" ? TriangleAlert : row.notice.kind === "success" ? Check : Info;
  return { icon: <Icon className="h-3.5 w-3.5 shrink-0" />, text: row.notice.title };
}

function summarizeStory(row: Extract<ImportantFeedRow, { kind: "story" }>): string {
  const { event } = row;
  if (event.story !== "BattleStory") return event.presentation.title;
  const description = event.presentation.description;
  const winner = formatWinnerName(
    findSegmentValue(parsePresentationDescription(description), (label) => label === "Winner"),
  );
  const sides = `${extractRoleLabel(description, "Attacker")} vs ${extractRoleLabel(description, "Defender")}`;
  return winner ? `${sides} · ${winner} wins` : sides;
}
