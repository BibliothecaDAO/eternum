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
  matchesEventsFilter,
  nextStripRows,
  selectImportantFeedRows,
  type ShownRow,
} from "./important-feed-rows";
import { useFeedRows } from "./use-feed-rows";
import { useEventsFilter } from "@/hooks/store/use-events-filter-store";

/** How many rows the Events strip keeps: the owner's three. */
const STRIP_ROWS = 3;

/**
 * The strip's rows: the last three actions the player's filter admits (`nextStripRows` holds its one rule), which stay
 * until newer ones it admits replace them, whatever the bounded sources drop meanwhile. What it showed is remembered for
 * each player and filter, three rows apiece, by the Events card, which stays mounted while its body is collapsed.
 */
export const useStripRows = (): ShownRow[] => {
  const { allRows, filter, address } = useImportantFeed();
  const memoryKey = `${address ?? "anyone"}:${filter}`;
  const [memory, setMemory] = useState<Record<string, ShownRow[]>>({});
  const remembered = memory[memoryKey] ?? NOTHING_SHOWN;
  const shown = nextStripRows(remembered, allRows, (row) => matchesEventsFilter(row, filter, address), STRIP_ROWS);
  // What the strip shows is remembered by setting it during render, as React advises: it converges at once.
  if (!sameShown(shown, remembered)) setMemory((current) => ({ ...current, [memoryKey]: shown }));
  return shown;
};
const NOTHING_SHOWN: ShownRow[] = [];

/** The strip: the offline row, then its rows. */
export const QuickFeedRows = ({ shown }: { shown: readonly ShownRow[] }) => (
  <>
    <FeedNotices pinned={[]} />
    {shown.map(({ key, row }) => (
      <FeedRowLine key={key} row={row} />
    ))}
  </>
);

/** The same rows, in the same order, telling the same: only then is there nothing new to remember. */
const sameShown = (a: readonly ShownRow[], b: readonly ShownRow[]): boolean =>
  a.length === b.length &&
  a.every((entry, index) => entry.key === b[index].key && rowWords(entry.row) === rowWords(b[index].row));

/** What a row says, for telling whether it changed: its source and, for a send, how it stands. */
const rowWords = (row: ImportantFeedRow): string =>
  `${row.id}:${row.kind === "transaction" ? row.transaction.status : ""}`;

/**
 * Every row Events holds and those the player's filter admits, with the game's headlines among them; and, for the
 * phone, the headlines of this tick, which it shows on their own.
 */
export function useImportantFeed() {
  const nowMs = useNowMs();
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const address = useAccountStore((state) => state.account?.address ?? null);
  const [filter] = useEventsFilter();
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, nowMs, tickSeconds);
  const stories = useEventsStories(address);
  const feed = useFeedRows();
  const allRows = selectImportantFeedRows(stories, feed, "all", address, [
    ...headlineFeed.pinned,
    ...headlineFeed.recent,
  ]);
  const admitted = (row: ImportantFeedRow) => matchesEventsFilter(row, filter, address);
  const pinned = headlineFeed.pinned.filter((headline) =>
    admitted({ kind: "headline", id: headline.id, at: headline.timestamp, headline }),
  );
  return { nowMs, rows: allRows.filter(admitted), allRows, pinned, filter, address };
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
