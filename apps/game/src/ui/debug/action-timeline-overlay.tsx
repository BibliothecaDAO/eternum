import { requestsDiagnostics } from "@/play/navigation/play-route";
import {
  readClientActionRecords,
  subscribeClientActionRecords,
  type ClientActionLatencyMeasurement,
} from "@/observability/client-action-latency";
import { useSyncExternalStore } from "react";

const SHOWN_ACTIONS = 8;

const formatMs = (ms: number): string => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * "explore_reveal · command +2ms · … · settled +170ms · rendered +410ms": each step's time since the click, or since
 * the command for a send no action claimed, in the order they happened.
 */
const describeAction = ({ operation, phases, send, failedReason }: ClientActionLatencyMeasurement): string => {
  const zero = phases.click ?? send?.stages[0]?.at ?? 0;
  const steps = [
    ...(send?.stages ?? []).map(({ stage, at, detail }) => ({ name: detail ? `${stage} ${detail}` : stage, at })),
    ...Object.entries(phases).flatMap(([phase, at]) =>
      phase === "click" || at === undefined ? [] : [{ name: phase, at }],
    ),
  ].sort((left, right) => left.at - right.at);
  const label = operation === "send" ? `send ${send?.key ?? ""}` : operation;
  return [
    label,
    ...steps.map(({ name, at }) => `${name} +${formatMs(at - zero)}`),
    ...(failedReason ? [`failed ${failedReason}`] : []),
  ].join(" · ");
};

const ActionTimeline = () => {
  const records = useSyncExternalStore(subscribeClientActionRecords, readClientActionRecords);
  const shown = records.slice(-SHOWN_ACTIONS).reverse();
  return (
    <section
      aria-label="Action timeline"
      className="pointer-events-auto fixed bottom-4 right-4 z-[9999] max-w-[560px] rounded-md border border-gold/40 bg-black/80 p-2 font-mono text-[11px] text-white shadow-xl"
    >
      <p className="mb-1 text-gold">Actions</p>
      {shown.length === 0 ? (
        <p className="text-white/60">No action yet.</p>
      ) : (
        <ol>
          {shown.map((record) => (
            <li key={record.actionId} className="border-t border-white/10 py-0.5">
              {describeAction(record)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

/** The last actions and sends, each step timed, for a page opened with ?logs=1. Without it, nothing subscribes. */
export const ActionTimelineOverlay = () =>
  requestsDiagnostics(new URLSearchParams(window.location.search)) ? <ActionTimeline /> : null;
