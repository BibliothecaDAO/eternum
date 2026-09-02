import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { FeedRow } from "./event-feed-rows";
import { FeedRowView } from "./feed-row-view";
import { useFeedRows } from "./use-feed-rows";

export const FEED_POPOVER_ID = "feed";

const Section = ({ title, rows, tone }: { title: string; rows: FeedRow[]; tone?: string }) => {
  if (rows.length === 0) return null;
  return (
    <section className="border-b border-gold/10 last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2">
        <span className={cn(HUD_LABEL, tone)}>{title}</span>
        <span className="rounded-full bg-gold/15 px-1.5 text-[10px] text-gold/70">{rows.length}</span>
      </div>
      <div className="space-y-px">
        {rows.map((row) => (
          <FeedRowView key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
};

/** The event feed: what is in flight, what has arrived, what just happened — one list, in the activity popover. */
export const EventFeedPanel = () => {
  const rows = useFeedRows();
  const clearCompletedTransactions = useTransactionStore((state) => state.clearCompletedTransactions);
  const isEmpty = rows.inFlight.length + rows.arrived.length + rows.recent.length === 0;

  if (isEmpty) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gold/50">Nothing yet</p>
        <p className="mt-1 text-xs text-gold/30">Your actions, caravans and notices will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        <Section title="In flight" rows={rows.inFlight} />
        <Section title="Arrived" rows={rows.arrived} tone="text-emerald-300" />
        <Section title="Recent" rows={rows.recent} />
      </div>
      <div className="flex items-center justify-between border-t border-gold/10 bg-dark-brown/30 px-3 py-2">
        <p className="text-[10px] text-gold/30">Click a transaction to view on Voyager</p>
        <button
          type="button"
          onClick={clearCompletedTransactions}
          className="text-[10px] uppercase tracking-wide text-gold/50 transition hover:text-gold"
        >
          Clear recent
        </button>
      </div>
    </div>
  );
};
