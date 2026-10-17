import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";

import { useMemo, useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import type { Headline } from "../news-headlines/headline-types";
import { FEED_ROW_CLASS, FeedRowLine, HeadlineIcon } from "./feed-row-line";
import {
  type ImportantFeedRow,
  quickFeedKey,
  selectImportantFeedRows,
  selectQuickFeedRows,
  sendKey,
} from "./important-feed-rows";
import { useFeedRows } from "./use-feed-rows";

const QUICK_FEED_WINDOW_MS = 20_000;
const QUICK_FEED_MAX_ROWS = 5;
const QUICK_FEED_FADE_MS = 3_000;

/**
 * The feed's pinned notices and its latest rows, each on screen 20 s from when it is first drawn: it fades over its
 * last seconds and leaves when the fade ends (`selectQuickFeedRows` holds the one rule).
 */
export const QuickFeedRows = () => {
  const { nowMs, rows, pinned, sends } = useImportantFeed();
  const [shown, setShown] = useState<readonly string[]>([]);
  const [ended, setEnded] = useState<ReadonlySet<string>>(() => new Set());
  const drawn = selectQuickFeedRows(rows, nowMs, { shown, ended }, sends, QUICK_FEED_WINDOW_MS, QUICK_FEED_MAX_ROWS);
  const keys = drawn.map(({ key }) => key);
  // What is on screen is remembered by setting it during render, as React advises: it converges at once.
  if (!sameOrder(keys, shown)) setShown(keys);
  const endRow = (key: string) => {
    const live = new Set(rows.map((row) => quickFeedKey(row, sends)));
    setEnded((previous) => new Set([...previous, key].filter((kept) => live.has(kept))));
  };
  return (
    <>
      <FeedNotices pinned={pinned} />
      {drawn.map(({ key, row }) => (
        <QuickFeedRow key={key} row={row} onFaded={() => endRow(key)} />
      ))}
    </>
  );
};

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => b[index] === key);

/** A drawn row: its fade starts with it on the compositor, and its end takes the row off the card. */
const QuickFeedRow = ({ row, onFaded }: { row: ImportantFeedRow; onFaded: () => void }) => (
  <div
    style={{
      animation: `quickFeedFade ${QUICK_FEED_FADE_MS}ms linear ${QUICK_FEED_WINDOW_MS - QUICK_FEED_FADE_MS}ms forwards`,
    }}
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) onFaded();
    }}
  >
    <FeedRowLine row={row} />
  </div>
);

/** The important rows every layout counts and previews, plus the headlines pinned for the current tick. */
export function useImportantFeed() {
  const nowMs = useNowMs();
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const address = useAccountStore((state) => state.account?.address ?? null);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, nowMs, tickSeconds);
  const stories = useEventsStories(address);
  const feed = useFeedRows();
  const rows = selectImportantFeedRows(stories, feed, "all", address, headlineFeed.recent);
  const sends = new Set(
    [...feed.inFlight, ...feed.recent].flatMap((row) =>
      row.kind === "transaction" ? [sendKey(row.transaction.hash)] : [],
    ),
  );
  return { nowMs, rows, pinned: headlineFeed.pinned, sends };
}

/**
 * The stories the Events card tells, each from a read that holds them: every battle and raid, and the crates the player
 * opened (where its relics went).
 */
function useEventsStories(address: string | null) {
  const { data: battles } = useStoryEvents(350, "BattleEvent");
  const { data: raids } = useStoryEvents(100, "RaidEvent");
  const { data: crates } = useStoryEvents(50, "RelicChestOpened", address ?? undefined);
  return useMemo(() => [...battles, ...raids, ...crates], [battles, raids, crates]);
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
        <span className="line-clamp-2 min-w-0 flex-1 break-words" title={headline.description}>
          {headline.description}
        </span>
      </div>
    ))}
  </>
);

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
