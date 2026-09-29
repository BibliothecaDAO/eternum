const DIFF_KINDS = ["preconfirmed", "confirmed"] as const;
type DiffKind = (typeof DIFF_KINDS)[number];

interface LatencyWindow {
  count: number;
  samples: number[];
  invariantViolations: number;
}

const SLOW_DIFF_MS = 200;
const DIGEST_WINDOW_MS = 60_000;
const MAX_SAMPLES_PER_WINDOW = 2_048;

const nearestRank = (sorted: number[], quantile: number): number => sorted[Math.ceil(quantile * sorted.length) - 1]!;

const emptyWindows = () =>
  new Map(DIFF_KINDS.map((kind) => [kind, { count: 0, samples: [], invariantViolations: 0 } as LatencyWindow]));

/**
 * Publish latency per diff kind: a pre-confirmed receipt's arrival to its publish, and a confirmed head's fold to its
 * publish. A slow diff is logged as it happens. One window spans every kind and closes lazily on the first record a
 * window after it opened, logging a digest for each kind, so a kind with no samples in an active window reads as a
 * zero count rather than silence. An idle Herald opens no window and logs nothing.
 */
export class DiffLatencyMonitor {
  private windowStartedAt: number | null = null;
  private windows = emptyWindows();

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly log: Pick<Console, "info" | "warn"> = console,
  ) {}

  /** `invariantViolations` counts the chain events this diff's fold skipped (see WorldFold.invariantViolations). */
  public record(kind: DiffKind, durationMs: number, invariantViolations = 0): void {
    if (durationMs > SLOW_DIFF_MS) {
      this.log.warn(JSON.stringify({ durationMs: Math.round(durationMs), event: "herald_diff_slow", kind }));
    }
    const now = this.now();
    this.windowStartedAt ??= now;
    const window = this.windows.get(kind)!;
    window.count += 1;
    window.invariantViolations += invariantViolations;
    // Percentiles come from the window's first samples so memory stays bounded; the count still covers every diff.
    if (window.samples.length < MAX_SAMPLES_PER_WINDOW) window.samples.push(durationMs);
    const windowMs = now - this.windowStartedAt;
    if (windowMs < DIGEST_WINDOW_MS) return;
    for (const [digestKind, digestWindow] of this.windows)
      this.log.info(JSON.stringify(digest(digestKind, digestWindow, windowMs)));
    this.windowStartedAt = now;
    this.windows = emptyWindows();
  }
}

function digest(kind: DiffKind, window: LatencyWindow, windowMs: number) {
  const base = {
    count: window.count,
    event: "herald_diff_latency_digest",
    kind,
    windowMs: Math.round(windowMs),
    // Present only when a skipped event needs attention, so a healthy digest reads as before.
    ...(window.invariantViolations > 0 ? { invariantViolations: window.invariantViolations } : {}),
  };
  if (window.count === 0) return base;
  const sorted = [...window.samples].sort((left, right) => left - right);
  return {
    ...base,
    maxMs: Math.round(sorted.at(-1)!),
    p50Ms: Math.round(nearestRank(sorted, 0.5)),
    p95Ms: Math.round(nearestRank(sorted, 0.95)),
  };
}
