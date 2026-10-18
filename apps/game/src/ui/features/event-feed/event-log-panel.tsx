import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { HudEmpty, HudNotice, HudPanel, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
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
      onDismiss={onDismiss}
      isInsideAnchor={isInsideAnchor}
    >
      <HudWindow title="Log" icon="chronicles" size="fit" onClose={onDismiss}>
        <div className="flex w-hud-column flex-col gap-2">
          <EventsFilterSwitch />
          {failed && <HudNotice tone="bad" line="Event history could not load." retry={retry} />}
          {!failed && events.stories.length === 0 && <HudEmpty icon="chronicles" line="Nothing here yet." />}
          <div className="flex flex-col">
            {events.stories.map((event) => (
              <FeedRowLine key={event.id} event={event} />
            ))}
          </div>
          <HudPanel kind="section" title="World history" label="World history" collapsible={false}>
            {oneStoryPerAction(world.data).map((event) => (
              <StoryFeedRow key={event.id} event={event} />
            ))}
          </HudPanel>
        </div>
      </HudWindow>
    </PopoverPanel>
  );
};
