type DiffKind = "preconfirmed" | "confirmed";

interface LatencyWindow {
  count: number;
  samples: number[];
  startedAt: number;
}

const SLOW_DIFF_MS = 200;
const DIGEST_WINDOW_MS = 60_000;
const MAX_SAMPLES_PER_WINDOW = 2_048;

const nearestRank = (sorted: number[], quantile: number): number => sorted[Math.ceil(quantile * sorted.length) - 1]!;

/**
 * Fold-to-publish latency per diff kind. A slow diff is logged as it happens; a per-kind digest is logged lazily by
 * the first record at least a window after the previous digest, so idle kinds stay silent and no timer runs.
 */
export class DiffLatencyMonitor {
  private readonly windows = new Map<DiffKind, LatencyWindow>();

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly log: Pick<Console, "info" | "warn"> = console,
  ) {}

  public record(kind: DiffKind, durationMs: number): void {
    if (durationMs > SLOW_DIFF_MS) {
      this.log.warn(JSON.stringify({ durationMs: Math.round(durationMs), event: "herald_diff_slow", kind }));
    }
    const now = this.now();
    const window = this.windowFor(kind, now);
    window.count += 1;
    // Percentiles come from the window's first samples so memory stays bounded; the count still covers every diff.
    if (window.samples.length < MAX_SAMPLES_PER_WINDOW) window.samples.push(durationMs);
    const windowMs = now - window.startedAt;
    if (windowMs < DIGEST_WINDOW_MS) return;
    this.log.info(JSON.stringify(this.digest(kind, window, windowMs)));
    this.windows.set(kind, { count: 0, samples: [], startedAt: now });
  }

  private windowFor(kind: DiffKind, now: number): LatencyWindow {
    let window = this.windows.get(kind);
    if (!window) {
      window = { count: 0, samples: [], startedAt: now };
      this.windows.set(kind, window);
    }
    return window;
  }

  private digest(kind: DiffKind, window: LatencyWindow, windowMs: number) {
    const sorted = [...window.samples].sort((left, right) => left - right);
    return {
      count: window.count,
      event: "herald_diff_latency_digest",
      kind,
      maxMs: Math.round(sorted.at(-1)!),
      p50Ms: Math.round(nearestRank(sorted, 0.5)),
      p95Ms: Math.round(nearestRank(sorted, 0.95)),
      windowMs: Math.round(windowMs),
    };
  }
}
