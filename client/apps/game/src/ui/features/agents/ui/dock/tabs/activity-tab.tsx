import { Sparkles, TimerReset } from "lucide-react";
import type { AgentEvent, AgentHistoryEntry } from "@bibliothecadao/types";

import {
  deduplicateConsecutiveEvents,
  describeEvent,
  describeEventDetail,
  describeHistoryEntry,
  formatEventLabel,
  formatTimestamp,
} from "../agent-dock-utils";

export const ActivityTab = ({
  recentEvents,
  recentHistory,
  latestRunSummary,
  statusTone,
}: {
  recentEvents: AgentEvent[];
  recentHistory: AgentHistoryEntry[];
  latestRunSummary: string;
  statusTone: string;
}) => {
  const latestEvent = recentEvents.at(-1) ?? null;
  const dedupedEvents = deduplicateConsecutiveEvents(recentEvents);

  return (
    <div className="space-y-4">
      {latestEvent ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold/10 bg-black/25 px-3 py-2 text-xs">
          <Sparkles className="h-3 w-3 shrink-0 text-gold/50" />
          <span className={`truncate ${statusTone}`}>{describeEvent(latestEvent)}</span>
          <span className="ml-auto shrink-0 text-gold/35">{formatTimestamp(latestEvent.createdAt)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-gold/10 bg-black/25 px-3 py-2 text-xs text-gold/50">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span>{latestRunSummary}</span>
        </div>
      )}

      {dedupedEvents.map(({ event, count }) => (
        <div
          key={event.id ?? `${event.type}-${event.createdAt}`}
          className="rounded-2xl border border-gold/10 bg-black/35 p-4"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold/50">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{formatEventLabel(event.type)}</span>
            {count > 1 && (
              <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold/60">x{count}</span>
            )}
            <span className="ml-auto text-gold/35">{formatTimestamp(event.createdAt)}</span>
          </div>
          <div className="mt-2 text-sm text-gold/80">{describeEvent(event)}</div>
          {describeEventDetail(event) ? (
            <div className="mt-2 text-xs text-gold/50">{describeEventDetail(event)}</div>
          ) : null}
        </div>
      ))}

      {recentHistory.length > 0 ? (
        <div className="rounded-2xl border border-gold/10 bg-black/25 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold/50">
            <TimerReset className="h-3.5 w-3.5" />
            <span>Recent Runs</span>
          </div>
          <div className="mt-3 space-y-3">
            {recentHistory.slice(0, 4).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gold/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-gold/45">
                  <span>{entry.title}</span>
                  <span>{formatTimestamp(entry.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-gold/80">{describeHistoryEntry(entry)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentEvents.length === 0 && recentHistory.length === 0 ? (
        <div className="rounded-2xl border border-gold/10 bg-black/35 p-4 text-sm text-gold/55">
          Activity will appear here once the agent starts acting in this world.
        </div>
      ) : null}
    </div>
  );
};
