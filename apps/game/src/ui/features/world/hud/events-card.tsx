import { cn } from "@/ui/design-system/atoms/lib/utils";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import {
  QuickFeedRows,
  UnreadFeedBadge,
  useImportantFeed,
  useUnreadFeedCount,
} from "@/ui/features/event-feed/quick-feed";
import { useRef } from "react";

/**
 * The rail's events: the offline row and pinned headlines, then what Events holds (battles, the player's realm news,
 * caravans and this session's sends) as it happens, each row fading after 20 s as the quick feed always did. With
 * nothing recent it is its header band alone. "All" opens the log, with what arrived since it was read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const { rows } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, logOpen);
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
            All
            <UnreadFeedBadge count={unread} />
          </button>
        }
        bodyClassName="flex flex-col gap-1 empty:hidden"
      >
        <QuickFeedRows />
      </InfoBubble>
    </>
  );
};
