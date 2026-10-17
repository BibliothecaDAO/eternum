import { cn } from "@/ui/design-system/atoms/lib/utils";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { EventsFilterSwitch } from "@/ui/features/event-feed/events-filter-switch";
import { QuickFeedRows, UnreadFeedBadge, useEventsFeed, useUnreadFeedCount } from "@/ui/features/event-feed/quick-feed";
import { useRef } from "react";

/**
 * The rail's events: the client's toasts (offline, notices, the clock's milestones), then the game's three newest
 * stories through the player's filter (Important by default, Mine or All, the Log's own filter too). With nothing to
 * show it is its header band alone. "Log" opens the full history, with what arrived since it was read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const { stories } = useEventsFeed();
  const unread = useUnreadFeedCount(stories, logOpen);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      {logOpen && (
        <EventLogPanel
          onDismiss={onLogToggle}
          isInsideAnchor={(target) => target instanceof Node && Boolean(button.current?.contains(target))}
        />
      )}
      <InfoBubble
        label="Events"
        title="Events"
        cue={
          <span className="inline-flex items-center gap-3">
            <EventsFilterSwitch />
            <button
              ref={button}
              type="button"
              aria-label="Log"
              aria-expanded={logOpen}
              onClick={onLogToggle}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1 font-semibold text-kit-cream hover:text-gold",
                logOpen && "text-gold",
              )}
            >
              Log
              <UnreadFeedBadge count={unread} />
            </button>
          </span>
        }
        bodyClassName="flex flex-col gap-1 empty:hidden"
      >
        <QuickFeedRows />
      </InfoBubble>
    </>
  );
};
