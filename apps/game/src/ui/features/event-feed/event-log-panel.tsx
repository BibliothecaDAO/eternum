import { HudEmpty, HudNotice, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { EventsFilterSwitch } from "./events-filter-switch";
import { useEventsFeed } from "./quick-feed";
import { StoryFeedRow } from "./story-feed-row";

/** The full history as a window by Events: every story the player's lens holds (EventLog). */
export const EventLogPanel = ({
  onDismiss,
  isInsideAnchor,
}: {
  onDismiss: () => void;
  isInsideAnchor: (target: EventTarget | null) => boolean;
}) => (
  <PopoverPanel
    id="event-log"
    ariaLabel="Event log"
    anchor="right-edge"
    onDismiss={onDismiss}
    isInsideAnchor={isInsideAnchor}
  >
    <HudWindow title="Log" icon="chronicles" size="fit" onClose={onDismiss}>
      <div className="flex w-hud-column flex-col gap-2">
        <EventLog />
      </div>
    </HudWindow>
  </PopoverPanel>
);

/**
 * The full history: every story behind the player's lens, the strip's own (Important, or All: the world's history),
 * newest first, each with its line (a fight's sides, forces and rolls).
 */
const EventLog = () => {
  const events = useEventsFeed();
  return (
    <>
      <EventsFilterSwitch />
      {events.isError && <HudNotice tone="bad" line={EVENTS_WORDS.failed} retry={events.retry} />}
      {!events.isError && events.stories.length === 0 && <HudEmpty icon="chronicles" line={EVENTS_WORDS.nothingYet} />}
      <div className="flex flex-col">
        {events.stories.map((event) => (
          <StoryFeedRow key={event.id} event={event} />
        ))}
      </div>
    </>
  );
};
