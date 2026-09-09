import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import { useState } from "react";
import { orderHeadlineFeed, useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import { FeedRowView } from "./feed-row-view";
import {
  groupFeedRowsByTick,
  type ImportantFeedFilter,
  resolveGameTick,
  selectImportantFeedRows,
} from "./important-feed-rows";
import { StoryFeedRow } from "./story-feed-row";
import { useFeedRows } from "./use-feed-rows";

const FILTERS: ImportantFeedFilter[] = ["all", "mine", "combat"];

/** The full history: the important rows grouped by tick behind All / Mine / Combat, then every world story. */
export const EventLogPanel = ({
  onDismiss,
  isInsideAnchor,
}: {
  onDismiss: () => void;
  isInsideAnchor: (target: EventTarget | null) => boolean;
}) => {
  const [filter, setFilter] = useState<ImportantFeedFilter>("all");
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  const startAt = useUIStore((state) => state.gameStartMainAt);
  const address = useAccountStore((state) => state.account?.address ?? null);
  const headlines = useHeadlineFeedStore((state) => state.headlines);
  const headlineFeed = orderHeadlineFeed(headlines, useNowMs(), tickSeconds);
  const { data: stories, isError, refetch } = useStoryEvents(350);
  const feed = useFeedRows();
  const groups = groupFeedRowsByTick(
    selectImportantFeedRows(stories, feed, filter, address, [...headlineFeed.pinned, ...headlineFeed.recent]),
    (at) => resolveGameTick(at, startAt, tickSeconds),
  );
  const history = [...stories].sort((left, right) => right.timestampMs - left.timestampMs);

  return (
    <PopoverPanel
      id="event-log"
      ariaLabel="Event log"
      anchor="right-edge"
      className="w-[360px] p-0"
      onDismiss={onDismiss}
      isInsideAnchor={isInsideAnchor}
    >
      <SurfaceFrame title="Log" icon={ScrollText} onClose={onDismiss} className="h-[calc(100vh-7rem)]">
        <div className="flex gap-3 border-b border-gold/15 px-3 py-2" aria-label="Event filters">
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn("font-sans capitalize", HUD_LABEL, filter === value ? "text-gold" : "text-gold/45")}
            >
              {value}
            </button>
          ))}
        </div>
        {isError && (
          <p className="px-3 py-2 text-xs text-danger">
            Event history could not load.{" "}
            <button type="button" className="font-sans text-xs underline" onClick={() => void refetch()}>
              Retry
            </button>
          </p>
        )}
        {!isError && groups.length === 0 && <p className="px-3 py-4 text-xs text-gold/50">No important events yet.</p>}
        {groups.map(({ tick, rows }) => (
          <section key={tick} aria-label={`Tick ${tick}`}>
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
        <section aria-label="World history">
          <div className="px-3 py-2">
            <span className={HUD_LABEL}>World history</span>
          </div>
          {history.map((event) => (
            <StoryFeedRow key={event.id} event={event} />
          ))}
        </section>
      </SurfaceFrame>
    </PopoverPanel>
  );
};
