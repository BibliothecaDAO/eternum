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
let longTaskObserver: PerformanceObserver | null = null;
// The post-reveal frame compiles what the reveal could not; keep listening that long after fadeIn.
const TRACE_TAIL_MS = 4_000;

const TRACE_STORAGE_KEY = "eternum:trace";

// The play router rewrites the query string on every scene change, so the flag is read when this module loads
// (put `?trace=flight` on the play map URL) and remembered for the session.
const readFlightTraceFlag = (): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined" || !window.location) return false;
  const requested = new URLSearchParams(window.location.search).get("trace");
  if (requested) window.sessionStorage.setItem(TRACE_STORAGE_KEY, requested);
  return (requested ?? window.sessionStorage.getItem(TRACE_STORAGE_KEY)) === "flight";
};

export const FLIGHT_TRACE_ENABLED = readFlightTraceFlag();

export function beginFlightTrace(from: string | undefined, to: string): void {
  if (!FLIGHT_TRACE_ENABLED) return;
  activeTrace = { startedAt: performance.now(), label: `${from ?? "?"}→${to}` };
  console.log(`[flight] flyOut ${activeTrace.label} at ${activeTrace.startedAt.toFixed(0)}ms`);
  observeLongTasks();
}

export function endFlightTrace(reason: string): void {
  if (!activeTrace) return;
  console.log(`[flight] ${offset()} ${reason}`);
  const trace = activeTrace;
  window.setTimeout(() => {
    if (activeTrace === trace) {
      activeTrace = null;
      longTaskObserver?.disconnect();
      longTaskObserver = null;
    }
  }, TRACE_TAIL_MS);
}

/** A React commit of the HUD during the flight: the route change re-renders it while the scene animates. */
export function traceFlightCommit(id: string, phase: string, actualDurationMs: number): void {
  if (!activeTrace || actualDurationMs <= FRAME_BUDGET_MS) return;
  console.log(`[flight] ${offset()} react ${id} ${phase} ${actualDurationMs.toFixed(1)}ms`);
}

// Long tasks catch what no frame owner wraps: module loading, layout, garbage collection.
function observeLongTasks(): void {
  if (longTaskObserver || typeof PerformanceObserver === "undefined") return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      if (!activeTrace) return;
      list.getEntries().forEach((entry) => {
        const at = entry.startTime - (activeTrace?.startedAt ?? 0);
        const source = (
          entry as PerformanceEntry & { attribution?: { containerType?: string; containerSrc?: string }[] }
        ).attribution?.[0];
        const where = source ? ` in ${source.containerType ?? "?"} ${source.containerSrc ?? ""}`.trimEnd() : "";
        console.log(`[flight] +${at.toFixed(0)}ms longtask ${entry.duration.toFixed(0)}ms${where}`);
      });
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    longTaskObserver = null;
  }
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
