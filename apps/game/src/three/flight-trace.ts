/**
 * Dev-only trace behind `?trace=flight`: for one scene flight it logs every frame over a budget with its dominant
 * frame-work owner and the offset from flyOut, plus the worldmap zoom refresh planner's decisions. Console only,
 * nothing rendered. Remove once the stutter it is chasing is fixed.
 */
const FRAME_BUDGET_MS = 16;

interface ActiveFlightTrace {
  startedAt: number;
  label: string;
}

let activeTrace: ActiveFlightTrace | null = null;

const TRACE_STORAGE_KEY = "eternum:trace";

// The play router rewrites the query string on every scene change, so the flag is read when this module loads
// (put `?trace=flight` on the play map URL) and remembered for the session.
const readFlightTraceFlag = (): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const requested = new URLSearchParams(window.location.search).get("trace");
  if (requested) window.sessionStorage.setItem(TRACE_STORAGE_KEY, requested);
  return (requested ?? window.sessionStorage.getItem(TRACE_STORAGE_KEY)) === "flight";
};

const FLIGHT_TRACE_ENABLED = readFlightTraceFlag();

export function isFlightTraceEnabled(): boolean {
  return FLIGHT_TRACE_ENABLED;
}

export function beginFlightTrace(from: string | undefined, to: string): void {
  if (!isFlightTraceEnabled()) return;
  activeTrace = { startedAt: performance.now(), label: `${from ?? "?"}→${to}` };
  console.log(`[flight] flyOut ${activeTrace.label} at ${activeTrace.startedAt.toFixed(0)}ms`);
}

export function endFlightTrace(reason: string): void {
  if (!activeTrace) return;
  console.log(`[flight] ${offset()} ${reason}`);
  activeTrace = null;
}

export function traceFlightFrame(durationMs: number, owner: { owner: string; maxCallMs: number } | null): void {
  if (!activeTrace || durationMs <= FRAME_BUDGET_MS) return;
  const ownerLabel = owner ? `${owner.owner} (longest call ${owner.maxCallMs.toFixed(1)}ms)` : "unattributed";
  console.log(`[flight] ${offset()} frame ${durationMs.toFixed(1)}ms owner=${ownerLabel}`);
}

export function traceFlightPlanner(decision: Record<string, unknown>): void {
  if (!activeTrace) return;
  const fields = Object.entries(decision)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(`[flight] ${offset()} planner ${fields}`);
}

function offset(): string {
  return `+${(performance.now() - (activeTrace?.startedAt ?? 0)).toFixed(0)}ms`;
}
