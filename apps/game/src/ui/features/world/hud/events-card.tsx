import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import {
  QuickFeedRows,
  UnreadFeedBadge,
  useImportantFeed,
  useUnreadFeedCount,
} from "@/ui/features/event-feed/quick-feed";
import { useRef } from "react";

/**
 * The rail's events: the offline row and pinned headlines, then what Events holds (battles, the player's realm news,
 * caravans and this session's sends) as it happens, each row fading after 20 s as the quick feed always did. "All"
 * opens the log, with what arrived since it was last read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const { rows } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, logOpen);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <section
      aria-label="Events"
      className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flex flex-col gap-1.5 rounded-xl p-3")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="hud-panel-title">Events</h2>
        <button
          ref={button}
          type="button"
          aria-expanded={logOpen}
          onClick={onLogToggle}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-kit-cream hover:text-gold",
            logOpen && "text-gold",
          )}
        >
          All
          <UnreadFeedBadge count={unread} />
        </button>
      </div>
      <QuickFeedRows />
      {logOpen && (
        <EventLogPanel
          onDismiss={onLogToggle}
          isInsideAnchor={(target) => target instanceof Node && Boolean(button.current?.contains(target))}
        />
      )}
    </section>
  );
};
