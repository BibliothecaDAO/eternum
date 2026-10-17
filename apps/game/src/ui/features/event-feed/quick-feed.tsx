import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useGame } from "@/hooks/context/game-context";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { type ProcessedStoryEvent, useStoryReads } from "@/hooks/store/use-story-events-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { TickIds } from "@bibliothecadao/types";

import { useEffect, useMemo, useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import type { HeadlineType } from "../news-headlines/headline-types";
import { useEventFeedStore } from "./event-feed-store";
import { eventsReads, selectEventStories } from "./event-stories";
import { FEED_ROW_CLASS, FeedRowLine, HeadlineIcon, ToastRow } from "./feed-row-line";

/** How many rows the Events strip shows: the owner's three. */
const STRIP_ROWS = 3;

/** The strip: the client's toasts, then the game's three newest stories through the player's filter. */
export const QuickFeedRows = () => {
  const { stories } = useEventsFeed();
  return (
    <>
      <FeedToasts />
      {stories.slice(0, STRIP_ROWS).map((event) => (
        <FeedRowLine key={event.id} event={event} />
      ))}
    </>
  );
};

/**
 * Events' stories through the player's filter, newest first, read by what the filter shows: the strip shows the first
 * three, the Log them all.
 */
export function useEventsFeed() {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const [filter] = useEventsFilter();
  const hyperstructures = useHyperstructureIds();
  const { data, queries } = useStoryReads(eventsReads(filter, address, hyperstructures));
  const stories = useMemo(
    () => selectEventStories(data, filter, address, (structureId) => hyperstructures.includes(structureId)),
    [data, filter, address, hyperstructures],
  );
  const failed = queries.filter((query) => query.isError);
  const retry = () => failed.forEach((query) => void query.refetch());
  return { stories, filter, address, isError: failed.length > 0, retry };
}

/** The game's Hyperstructures, read from its facts as they change: a capture of one is everyone's news. */
const useHyperstructureIds = (): number[] => {
  const { setup } = useGame();
  const revision = useNativeRevision(["Hyperstructure"]);
  return useMemo(
    () =>
      [...setup.store.inGame("Hyperstructure", configManager.getActiveGameId())].map((row) =>
        safeInteger(row.entity_id),
      ),
    [setup, revision],
  );
};

/** Stories that arrived since the log was last open; zero while it is open. */
export function useUnreadFeedCount(stories: ProcessedStoryEvent[], logOpen: boolean): number {
  const [seen, setSeen] = useState(() => ({ logOpen, at: Date.now() }));
  // Opening or closing the log marks every story it holds as seen.
  if (seen.logOpen !== logOpen) {
    setSeen({ logOpen, at: Math.max(seen.at, ...stories.map((event) => event.timestampMs)) });
  }
  return logOpen ? 0 : stories.filter((event) => event.timestampMs > seen.at).length;
}

export const UnreadFeedBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span aria-label="Unread events" className="rounded-full bg-gold px-1.5 text-[10px] text-dark-brown">
      {count}
    </span>
  ) : null;

/** The game's capture headlines: a story tells each capture, so only the other milestones show as toasts. */
const TOLD_BY_STORIES = new Set<HeadlineType>(["hyper-capture", "realm-fall"]);

/**
 * The client's own toasts, which no layout hides and no story tells: the red offline row, the notices still within
 * their time (a refusal, a warning), and the game clock's milestones in their tick (its start and what scores, its last
 * five minutes, its end).
 */
export const FeedToasts = () => {
  const notices = useLiveNotices();
  const nowMs = useNowMs();
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const milestones = orderHeadlineFeed(headlines, nowMs, Number(configManager.getTick(TickIds.Armies))).pinned.filter(
    (headline) => !TOLD_BY_STORIES.has(headline.type),
  );
  return (
    <>
      <OfflineRow />
      {milestones.map((headline) => (
        <ToastRow
          key={headline.id}
          icon={<HeadlineIcon type={headline.type} />}
          text={headline.description}
          place={headline.location ?? null}
        />
      ))}
      {notices.map((notice) => (
        <ToastRow
          key={notice.id}
          icon={<NoticeIcon kind={notice.kind} />}
          text={notice.title}
          place={notice.location ?? null}
        />
      ))}
    </>
  );
};

/** The notices still within their time, newest first; the list redraws as the next one's time ends. */
const useLiveNotices = () => {
  const notices = useEventFeedStore((state) => state.notices);
  const [now, setNow] = useState(Date.now);
  const live = notices.filter((notice) => now - notice.at < notice.ttlMs);
  const nextEnd = Math.min(...live.map((notice) => notice.at + notice.ttlMs));
  useEffect(() => {
    if (!Number.isFinite(nextEnd)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextEnd - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextEnd]);
  useEffect(() => {
    setNow(Date.now());
  }, [notices]);
  return live;
};

const NoticeIcon = ({ kind }: { kind: "info" | "success" | "error" | "warning" }) => (
  <SemanticIcon
    name={kind === "error" || kind === "warning" ? "warning" : kind === "success" ? "check" : "info"}
    className={cn("h-4 w-4 shrink-0", kind === "error" && "text-danger")}
  />
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
