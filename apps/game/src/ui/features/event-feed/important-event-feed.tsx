import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useHeadlineFeedStore, orderHeadlineFeed } from "../news-headlines/headline-feed-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useEventsPanelStore } from "./events-panel-store";
import { EventFeedPanel } from "./event-feed-panel";
import { FeedRowView } from "./feed-row-view";
import { groupFeedRowsByTick, selectImportantFeedRows } from "./important-feed-rows";
import { StoryFeedRow } from "./story-feed-row";
import { useFeedRows } from "./use-feed-rows";

export const ImportantEventFeed = () => {
  const filter = useEventsPanelStore((state) => state.filter);
  const setFilter = useEventsPanelStore((state) => state.openEvents);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, useNowMs(), Number(configManager.getTick(TickIds.Armies)));
  const address = useAccountStore((state) => state.account?.address ?? null);
  const { data: stories, isError, refetch } = useStoryEvents(350, "BattleStory");
  const feed = useFeedRows();
  const groups = groupFeedRowsByTick(
    selectImportantFeedRows(stories, feed, filter === "log" ? "all" : filter, address, headlineFeed.recent),
    Number(configManager.getTick(TickIds.Armies)),
  );
  return (
    <section aria-label="Event feed" className={cn("pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden")}>
      <div className="flex items-center justify-between border-b border-gold/15 px-3 py-2">
        <div className="flex gap-2" aria-label="Event filters">
          {(["all", "mine", "combat", "log"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn("text-[10px] capitalize", filter === value ? "text-gold" : "text-gold/45")}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20">
        {headlineFeed.pinned.map((headline) => (
          <div
            key={headline.id}
            aria-label="Pinned event"
            className="border-b border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold"
          >
            {headline.description}
          </div>
        ))}
        {filter === "log" ? (
          <EventFeedPanel />
        ) : (
          <>
            {isError && (
              <p className="px-3 py-2 text-xs text-danger">
                Event history could not load.{" "}
                <button
                  type="button"
                  className="font-sans text-xs underline"
                  onClick={() => void refetch({ cancelRefetch: false })}
                >
                  Retry
                </button>
              </p>
            )}

            {!isError && groups.length === 0 && (
              <p className="px-3 py-4 text-xs text-gold/50">No important events yet.</p>
            )}
            {groups.map(({ tick, rows }) => (
              <section key={tick}>
                <div className="border-y border-gold/10 px-3 py-1 text-[10px] text-gold/50">Tick {tick}</div>
                {rows.map((row) =>
                  row.kind === "headline" ? (
                    <div key={row.id} className="px-3 py-2 text-xs text-gold">
                      {row.headline.description}
                    </div>
                  ) : row.kind === "story" ? (
                    <StoryFeedRow key={row.id} event={row.event} />
                  ) : (
                    <FeedRowView key={row.id} row={row} compact />
                  ),
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </section>
  );
};
