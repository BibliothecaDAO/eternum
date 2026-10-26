import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { EventsFilterSwitch } from "@/ui/features/event-feed/events-filter-switch";
import { QuickFeedRows, UnreadFeedBadge, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { forwardRef, type ReactNode, useRef } from "react";

/**
 * The rail's events: the client's toasts (offline, notices, the clock's milestones), then the game's three newest
 * stories through the player's lens (Important by default, or All, the world's history; the Log's own lens too). With
 * nothing to show it says so in one line. "Log" opens the full history, with the important stories arrived since it was
 * read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const unread = useUnreadImportantCount(logOpen);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      {logOpen && (
        <EventLogPanel
          onDismiss={onLogToggle}
          isInsideAnchor={(target) => target instanceof Node && Boolean(button.current?.contains(target))}
        />
      )}
      <EventsPanel ref={button} logOpen={logOpen} onLogToggle={onLogToggle} unread={unread}>
        <QuickFeedRows />
      </EventsPanel>
    </>
  );
};

/** The events' panel: its name, the lens and Log with its unread count, over the rows it is given. */
export const EventsPanel = forwardRef<
  HTMLButtonElement,
  { logOpen: boolean; onLogToggle: () => void; unread: number; children: ReactNode }
>(({ logOpen, onLogToggle, unread, children }, logButton) => (
  <HudPanel
    label="Events"
    title="Events"
    cue={
      <span className="inline-flex items-center gap-3">
        <EventsFilterSwitch />
        <HudButton
          ref={logButton}
          kind="quiet"
          size="sm"
          aria-label="Log"
          aria-expanded={logOpen}
          onClick={onLogToggle}
        >
          Log
          <UnreadFeedBadge count={unread} />
        </HudButton>
      </span>
    }
    bodyClassName="flex flex-col gap-1 empty:hidden"
  >
    {children}
  </HudPanel>
));
EventsPanel.displayName = "EventsPanel";
