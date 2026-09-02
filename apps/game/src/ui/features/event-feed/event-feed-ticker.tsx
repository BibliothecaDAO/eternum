import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useEffect, useState } from "react";
import { selectTickerRows } from "./event-feed-rows";
import { FeedRowView } from "./feed-row-view";
import { useFeedRows } from "./use-feed-rows";

const TICKER_WINDOW_MS = 6_000;
const TICKER_MAX_ROWS = 3;

/**
 * What just happened, at the bottom centre where the toaster stood: the newest feed rows for a few seconds each.
 * A row leaves on its own clock (one timeout to the next expiry); the feed panel keeps the history.
 */
export const EventFeedTicker = () => {
  const rows = useFeedRows();
  const [, setTick] = useState(0);
  const nowMs = Date.now();
  const visible = selectTickerRows(rows, nowMs, TICKER_WINDOW_MS).slice(0, TICKER_MAX_ROWS);

  useEffect(() => {
    if (visible.length === 0) return;
    const nextExpiry = Math.min(
      ...visible.map((row) => row.at + (row.kind === "notice" ? row.notice.ttlMs : TICKER_WINDOW_MS)),
    );
    const timeout = window.setTimeout(() => setTick((tick) => tick + 1), Math.max(50, nextExpiry - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex flex-col items-center gap-2">
      {visible.map((row) => (
        <div key={row.id} className={cn("pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-xl", OVERLAY_SURFACE_BASE)}>
          <FeedRowView row={row} />
        </div>
      ))}
    </div>
  );
};
