import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { selectQuickFeedRows } from "@/ui/features/event-feed/important-feed-rows";
import {
  FeedNotices,
  UnreadFeedBadge,
  useConnectionNotices,
  useImportantFeed,
  useUnreadFeedCount,
} from "@/ui/features/event-feed/quick-feed";
import { useRef } from "react";

const LATEST_ROWS = 3;

/** The latest rows stay until newer ones replace them: the quick feed's selection with no time window. */
const selectLatestFeedRows: typeof selectQuickFeedRows = (rows, nowMs, _window, maxRows) =>
  selectQuickFeedRows(rows, nowMs, Number.POSITIVE_INFINITY, maxRows);

/**
 * The rail's event log: the offline row and pinned headlines, then the three latest of what Events holds
 * (selectImportantFeedRows: battles, the player's realm news, caravans and this session's sends), which stay until
 * newer ones replace them. "All" opens the log, with what arrived since it was last read.
 */
export const EventsCard = ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => {
  const { nowMs, rows, pinned } = useImportantFeed();
  const unread = useUnreadFeedCount(rows, logOpen);
  const button = useRef<HTMLButtonElement>(null);
  const latest = selectLatestFeedRows(rows, nowMs, 0, LATEST_ROWS);
  useConnectionNotices();
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
      <FeedNotices pinned={pinned} />
      {latest.map((row) => (
        <FeedRowLine key={row.id} row={row} />
      ))}
      {latest.length === 0 && pinned.length === 0 && (
        <p className="text-sm text-kit-muted">No battles or news from your realms yet.</p>
      )}
      {logOpen && (
        <EventLogPanel
          onDismiss={onLogToggle}
          isInsideAnchor={(target) => target instanceof Node && Boolean(button.current?.contains(target))}
        />
      )}
    </section>
  );
};
