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
  endQuickFeedRow,
  type ImportantFeedRow,
  nextQuickFeed,
  type QuickFeed,
  selectImportantFeedRows,
  type ShownRow,
} from "./important-feed-rows";
import { useFeedRows } from "./use-feed-rows";

const QUICK_FEED_WINDOW_MS = 20_000;
const QUICK_FEED_MAX_ROWS = 5;
const QUICK_FEED_FADE_MS = 3_000;

/**
 * The feed's pinned notices and its own short list of rows (`nextQuickFeed` holds its one rule): each on screen 20 s
 * from when it is first shown, fading over its last seconds and leaving when the fade ends.
 */
export const QuickFeedRows = () => {
  const { nowMs, rows, pinned, address } = useImportantFeed();
  const [feed, setFeed] = useState<QuickFeed>({ shown: [], ended: [] });
  const next = nextQuickFeed(feed, rows, {
    nowMs,
    address,
    windowMs: QUICK_FEED_WINDOW_MS,
    maxRows: QUICK_FEED_MAX_ROWS,
  });
  // What Events shows is remembered by setting it during render, as React advises: it converges at once.
  if (!sameShown(next.shown, feed.shown) || next.ended.length !== feed.ended.length) setFeed(next);
  return (
    <>
      <FeedNotices pinned={pinned} />
      {next.shown.map((entry) => (
        <QuickFeedRow
          key={entry.key}
          entry={entry}
          onFaded={() => setFeed((current) => endQuickFeedRow(current, entry.key))}
        />
      ))}
    </>
  );
};

/** The same rows, in the same order, telling the same: only then is there nothing new to remember. */
const sameShown = (a: readonly ShownRow[], b: readonly ShownRow[]): boolean =>
  a.length === b.length &&
  a.every((entry, index) => entry.key === b[index].key && rowWords(entry.row) === rowWords(b[index].row));

/** What a row says, for telling whether it changed: its source and, for a send, how it stands. */
const rowWords = (row: ImportantFeedRow): string =>
  `${row.id}:${row.kind === "transaction" ? row.transaction.status : ""}`;

/** A shown row: its fade starts with it on the compositor (17 s, then 3 s), and its end takes it off the card for good. */
const QuickFeedRow = ({ entry, onFaded }: { entry: ShownRow; onFaded: () => void }) => (
  <div
    style={{
      animation: `quickFeedFade ${QUICK_FEED_FADE_MS}ms linear ${QUICK_FEED_WINDOW_MS - QUICK_FEED_FADE_MS}ms forwards`,
    }}
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) onFaded();
    }}
  >
    <FeedRowLine row={entry.row} />
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
  return { nowMs, rows, pinned: headlineFeed.pinned, address };
}

/**
 * The stories the Events card tells, each from a read that holds them: every battle, raid and capture, and every story
 * of the player's own, so each of their actions is told by the story it wrote (a crate's relics, a delivery, an
 * explore's find, a building, a level-up, a send) in the Log's words, whatever that story's level.
 */
function useEventsStories(address: string | null) {
  const { data: battles } = useStoryEvents(350, "BattleEvent");
  const { data: raids } = useStoryEvents(100, "RaidEvent");
  const { data: captures } = useStoryEvents(100, "StructureCapturedStory");
  const { data: own } = useStoryEvents(150, undefined, address ?? undefined);
  return useMemo(() => {
    const told = [...battles, ...raids, ...captures];
    const ids = new Set(told.map(({ id }) => id));
    return [...told, ...(address ? own.filter(({ id }) => !ids.has(id)) : [])];
  }, [battles, raids, captures, own, address]);
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
        <span className="min-w-0 flex-1 break-words">{headline.description}</span>
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
