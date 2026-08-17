interface FrameWorkOwnerStat {
  durationMs: number;
  lastSequence: number;
}

// Ownership is deliberately synchronous: queued work captures the marker when
// scheduled, while overlapping promises must never share ambient ownership.
let currentOwner: string | null = null;
let ownerSequence = 0;
const frameOwnerStats = new Map<string, FrameWorkOwnerStat>();

export function getCurrentFrameWorkOwner(): string | null {
  return import.meta.env.DEV ? currentOwner : null;
}

export function runWithFrameWorkOwner<T>(owner: string, work: () => T, now: () => number = defaultNow): T {
  if (!import.meta.env.DEV) {
    return work();
  }

  const previousOwner = currentOwner;
  const startedAt = now();
  currentOwner = owner;

  try {
    return work();
  } finally {
    recordFrameWorkOwner(owner, Math.max(0, now() - startedAt));
    currentOwner = previousOwner;
  }
}

export function consumeDominantFrameWorkOwner(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  let dominantOwner: string | null = null;
  let dominantStat: FrameWorkOwnerStat | null = null;

  frameOwnerStats.forEach((stat, owner) => {
    if (
      dominantStat === null ||
      stat.durationMs > dominantStat.durationMs ||
      (stat.durationMs === dominantStat.durationMs && stat.lastSequence > dominantStat.lastSequence)
    ) {
      dominantOwner = owner;
      dominantStat = stat;
    }
  });
  frameOwnerStats.clear();
  return dominantOwner;
}

function recordFrameWorkOwner(owner: string, durationMs: number): void {
  const stat = frameOwnerStats.get(owner) ?? { durationMs: 0, lastSequence: 0 };
  stat.durationMs += durationMs;
  stat.lastSequence = ++ownerSequence;
  frameOwnerStats.set(owner, stat);
}

function defaultNow(): number {
  return performance.now();
}
