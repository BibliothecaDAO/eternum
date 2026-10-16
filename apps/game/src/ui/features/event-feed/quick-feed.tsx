import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";

import { useEffect, useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import type { Headline } from "../news-headlines/headline-types";
import { FEED_ROW_CLASS, FeedRowLine, HeadlineIcon } from "./feed-row-line";
import { type ImportantFeedRow, selectImportantFeedRows, selectQuickFeedRows } from "./important-feed-rows";
import { toast } from "./notify";
import { useFeedRows } from "./use-feed-rows";

const QUICK_FEED_WINDOW_MS = 20_000;
const QUICK_FEED_MAX_ROWS = 5;
const QUICK_FEED_FADE_MS = 3_000;
const CONNECTION_NOTICE_ID = "connection";

/** The feed's pinned notices and its latest rows, fading after 20 s. */
export const QuickFeedRows = () => {
  const { nowMs, rows, pinned } = useImportantFeed();
  const visible = selectQuickFeedRows(rows, nowMs, QUICK_FEED_WINDOW_MS, QUICK_FEED_MAX_ROWS);
  useConnectionNotices();
  return (
    <>
      <FeedNotices pinned={pinned} />
      {visible.map((row) => (
        <QuickFeedRow key={row.id} row={row} />
      ))}
    </>
  );
};

/** A row fades out over its last seconds on the compositor: the delay is fixed at mount, so the once-a-second
 *  clock that removes it never restarts or steps the fade. */
const QuickFeedRow = ({ row }: { row: ImportantFeedRow }) => {
  const [delayMs] = useState(() => Math.max(0, row.at + QUICK_FEED_WINDOW_MS - QUICK_FEED_FADE_MS - Date.now()));
  return (
    <FeedRowLine
      row={row}
      style={{ animation: `quickFeedFade ${QUICK_FEED_FADE_MS}ms linear ${delayMs}ms forwards` }}
    />
  );
};

/** The important rows every layout counts and previews, plus the headlines pinned for the current tick. */
export function useImportantFeed() {
  const nowMs = useNowMs();
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const address = useAccountStore((state) => state.account?.address ?? null);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, nowMs, tickSeconds);
  const { data: stories } = useStoryEvents(350, "BattleEvent");
  const feed = useFeedRows();
  const rows = selectImportantFeedRows(stories, feed, "all", address, headlineFeed.recent);
  return { nowMs, rows, pinned: headlineFeed.pinned };
}

/** Rows that arrived since the log was last open; zero while it is open. */
export function useUnreadFeedCount(rows: ImportantFeedRow[], logOpen: boolean): number {
  const [seen, setSeen] = useState(() => ({ logOpen, at: Date.now() }));
  // Opening or closing the log marks every row it holds as seen.
  if (seen.logOpen !== logOpen) setSeen({ logOpen, at: Math.max(seen.at, ...rows.map((row) => row.at)) });
  return logOpen ? 0 : rows.filter((row) => row.at > seen.at).length;
}

export const UnreadFeedBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span aria-label="Unread events" className="rounded-full bg-gold px-1.5 text-[10px] text-dark-brown">
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
      <SemanticIcon name="network-off" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Offline</span>
      <button
        type="button"
        disabled={reconnecting}
        onClick={() => void triggerConnectionForceReconnect()}
        className="inline-flex items-center gap-1 font-sans text-xs normal-case tracking-normal text-danger hover:underline disabled:cursor-wait"
      >
        <SemanticIcon name="refresh" className={cn("h-3 w-3", reconnecting && "animate-spin")} />
        Retry
      </button>
    </div>
  );
}
