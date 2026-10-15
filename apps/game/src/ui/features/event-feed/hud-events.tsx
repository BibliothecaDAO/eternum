import type { ReactNode } from "react";
import { HudPanel } from "../world/containers/arena-hud-view";
import { FeedNotices, useImportantFeed, useConnectionNotices } from "./quick-feed";
import { FeedRowLine } from "./feed-row-line";
export function HudEventsView({ children }: { children: ReactNode }) {
  return (
    <HudPanel title="Events" className="events-panel">
      {children}
    </HudPanel>
  );
}
export function HudEvents() {
  const { rows, pinned } = useImportantFeed();
  useConnectionNotices();
  return (
    <HudEventsView>
      <FeedNotices pinned={pinned} />
      {rows.slice(0, 2).map((row) => (
        <FeedRowLine key={row.id} row={row} />
      ))}
      {rows.length === 0 && <p>No recent events.</p>}
    </HudEventsView>
  );
}
