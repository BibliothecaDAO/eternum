import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { FeedRowLine } from "./feed-row-line";
import { EventsFilterSwitch } from "./events-filter-switch";
import { oneStoryPerAction } from "./event-stories";
import { useEventsFeed } from "./quick-feed";
import { StoryFeedRow } from "./story-feed-row";

/**
 * The full history: Events' stories behind the player's filter (Important, Mine or All), from the strip's own reads, so
 * what the strip shows the Log shows; newest first, then every world story.
 */
export const EventLogPanel = ({
  onDismiss,
  isInsideAnchor,
}: {
  onDismiss: () => void;
  isInsideAnchor: (target: EventTarget | null) => boolean;
}) => {
  const events = useEventsFeed();
  const world = useStoryEvents(350);
  const failed = events.isError || world.isError;
  const retry = () => {
    events.retry();
    if (world.isError) void world.refetch();
  };

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
        {failed && (
          <p className="px-3 py-2 text-xs text-danger">
            Event history could not load.{" "}
            <button type="button" className="font-sans text-xs underline" onClick={retry}>
              Retry
            </button>
          </p>
        )}
        {!failed && events.stories.length === 0 && <p className="px-3 py-4 text-xs text-gold/50">Nothing here yet.</p>}
        <div className="flex flex-col gap-1 px-2 py-2">
          {events.stories.map((event) => (
            <FeedRowLine key={event.id} event={event} />
          ))}
        </div>
        <section aria-label="World history">
          <div className="px-3 py-2">
            <span className={HUD_LABEL}>World history</span>
          </div>
          {oneStoryPerAction(world.data).map((event) => (
            <StoryFeedRow key={event.id} event={event} />
          ))}
        </section>
      </SurfaceFrame>
    </PopoverPanel>
  );
};
