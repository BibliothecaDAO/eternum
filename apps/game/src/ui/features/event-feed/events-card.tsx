import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { RefreshCw, WifiOff } from "@/ui/design-system/atoms/game-icons";
import { useEffect, useRef, useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import type { Headline } from "../news-headlines/headline-types";
import { EventLogPanel } from "./event-log-panel";
import { FEED_ROW_CLASS, FeedRowLine, HeadlineIcon } from "./feed-row-line";
import { type ImportantFeedRow, selectImportantFeedRows, selectLatestFeedRows } from "./important-feed-rows";
import { toast } from "./notify";
import { useFeedRows } from "./use-feed-rows";

const LATEST_ROWS = 3;
const CONNECTION_NOTICE_ID = "connection";

/**
 * The right column's events: the offline row and pinned headlines, then the three latest of what Events holds
 * (selectImportantFeedRows: battles, the player's realm news, caravans and this session's sends), which stay until
 * newer ones replace them. "All" opens the log, with what arrived since it was last read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const { nowMs, rows, pinned, history } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, logOpen);
  const button = useRef<HTMLButtonElement>(null);
  const latest = selectLatestFeedRows(rows, nowMs, LATEST_ROWS);
  useConnectionNotices();
  return (
    <section
      aria-label="Events"
      className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flex flex-col gap-1.5 rounded-xl p-3")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-kit-muted">Events</h2>
        <button
          ref={button}
          type="button"
          aria-expanded={logOpen}
          onClick={onLogToggle}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-kit-cream hover:text-gold",
            logOpen && "text-gold",
          )}
        >
          All
          <UnreadFeedBadge count={unread} />
        </button>
      </div>
      <FeedNotices pinned={pinned} />
      {latest.map((row) => (
        <FeedRowLine key={row.id} row={row} />
      ))}
      {latest.length === 0 && pinned.length === 0 && <EmptyEvents history={history} />}
      {logOpen && (
        <EventLogPanel
          onDismiss={onLogToggle}
          isInsideAnchor={(target) => target instanceof Node && Boolean(button.current?.contains(target))}
        />
      )}
    </section>
  );
};

/** The important rows every layout counts and previews, plus the headlines pinned for the current tick. */
export function useImportantFeed() {
  const nowMs = useNowMs();
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const address = useAccountStore((state) => state.account?.address ?? null);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, nowMs, tickSeconds);
  const { data: stories, isPending, isError, refetch } = useStoryEvents(350);
  const feed = useFeedRows();
  const rows = selectImportantFeedRows(stories, feed, "all", address, headlineFeed.recent);
  const history: HistoryState = isError
    ? { state: "failed", retry: () => void refetch() }
    : { state: isPending ? "loading" : "ready" };
  return { nowMs, rows, pinned: headlineFeed.pinned, history };
}

/** Where the game's history, which brings Events' stories back after a reload, stands. */
type HistoryState = { state: "loading" | "ready" } | { state: "failed"; retry: () => void };

/** An empty card says why: history still loading, history that could not load, or nothing of its kind yet. */
const EmptyEvents = ({ history }: { history: HistoryState }) => {
  if (history.state === "loading") return <p className="text-sm text-kit-muted">Loading events…</p>;
  if (history.state === "failed")
    return (
      <p className="text-sm text-danger">
        Events could not load.{" "}
        <button type="button" className="text-sm underline" onClick={history.retry}>
          Retry
        </button>
      </p>
    );
  return <p className="text-sm text-kit-muted">No battles or news from your realms yet.</p>;
};

/** Rows that arrived since the log was last open; zero while it is open. */
export function useUnreadFeedCount(rows: ImportantFeedRow[], logOpen: boolean): number {
  const [seen, setSeen] = useState(() => ({ logOpen, at: Date.now() }));
  // Opening or closing the log marks every row it holds as seen.
  if (seen.logOpen !== logOpen) setSeen({ logOpen, at: Math.max(seen.at, ...rows.map((row) => row.at)) });
  return logOpen ? 0 : rows.filter((row) => row.at > seen.at).length;
}

export const UnreadFeedBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span aria-label="Unread events" className="rounded-full bg-gold px-1.5 text-sm text-dark-brown">
      {count}
    </span>
  ) : null;

/** The notices no layout hides: the red offline row, then the headlines pinned for this tick. */
export const FeedNotices = ({ pinned }: { pinned: Headline[] }) => (
  <>
    <OfflineRow />
    {pinned.map((headline) => (
      <div key={headline.id} aria-label="Pinned event" className={cn(FEED_ROW_CLASS, "border border-gold/60")}>
        <HeadlineIcon type={headline.type} />
        <span className="min-w-0 flex-1 truncate">{headline.description}</span>
      </div>
    ))}
  </>
);

/** Connection transitions become feed rows; the offline state is the pinned red row. */
export function useConnectionNotices() {
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
    <div aria-label="Offline" className={cn(FEED_ROW_CLASS, "border border-danger/60 text-danger")}>
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Offline</span>
      <button
        type="button"
        disabled={reconnecting}
        onClick={() => void triggerConnectionForceReconnect()}
        className="inline-flex items-center gap-1 text-sm text-danger hover:underline disabled:cursor-wait"
      >
        <RefreshCw className={cn("h-3 w-3", reconnecting && "animate-spin")} />
        Retry
      </button>
    </div>
  );
}
