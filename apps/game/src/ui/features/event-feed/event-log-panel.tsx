import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { FeedRowLine } from "./feed-row-line";
import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { EventsFilterSwitch } from "./events-filter-switch";
import { oneStoryPerAction, selectEventStories } from "./event-stories";
import { useIsHyperstructure } from "./quick-feed";
import { StoryFeedRow } from "./story-feed-row";

/**
 * The full history: Events' stories behind the player's filter (Important, Mine or All, the same as the strip), newest
 * first, then every world story.
 */
export const EventLogPanel = ({
  onDismiss,
  isInsideAnchor,
}: {
  onDismiss: () => void;
  isInsideAnchor: (target: EventTarget | null) => boolean;
}) => {
  const [filter] = useEventsFilter();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const { data: stories, isError, refetch } = useStoryEvents(350);
  const told = selectEventStories(stories, filter, address, useIsHyperstructure());

  return (
    <PopoverPanel
      id="event-log"
      ariaLabel="Event log"
      anchor="right-edge"
      className="w-[360px] p-0"
      onDismiss={onDismiss}
      isInsideAnchor={isInsideAnchor}
    >
      <SurfaceFrame title="Log" icon={"chronicles" as const} onClose={onDismiss} className="h-[calc(100vh-7rem)]">
        <EventsFilterSwitch className="border-b border-gold/15 px-3 py-2" />
        {isError && (
          <p className="px-3 py-2 text-xs text-danger">
            Event history could not load.{" "}
            <button type="button" className="font-sans text-xs underline" onClick={() => void refetch()}>
              Retry
            </button>
          </p>
        )}
        {!isError && told.length === 0 && <p className="px-3 py-4 text-xs text-gold/50">Nothing here yet.</p>}
        <div className="flex flex-col gap-1 px-2 py-2">
          {told.map((event) => (
            <FeedRowLine key={event.id} event={event} />
          ))}
        </div>
        <section aria-label="World history">
          <div className="px-3 py-2">
            <span className={HUD_LABEL}>World history</span>
          </div>
          {oneStoryPerAction(stories).map((event) => (
            <StoryFeedRow key={event.id} event={event} />
          ))}
        </section>
      </SurfaceFrame>
    </PopoverPanel>
  );
};
