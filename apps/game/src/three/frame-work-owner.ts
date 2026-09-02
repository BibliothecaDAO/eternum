interface FrameWorkOwnerStat {
  durationMs: number;
  frameGeneration: number;
  lastSequence: number;
  maxCallMs: number;
}

/**
 * The owner that accounted for the most attributed time in the frame: the total across its calls, and its longest
 * single call, so a frame full of small slices reads differently from one long task.
 */
export interface DominantFrameWorkOwner {
  durationMs: number;
  maxCallMs: number;
  owner: string;
}

// Ownership is deliberately synchronous: queued work captures the marker when
// scheduled, while overlapping promises must never share ambient ownership.
let currentOwner: string | null = null;
let frameGeneration = 0;
let ownerSequence = 0;
// Callers use bounded, stable labels. Retaining one stat per label avoids a new
// object for every frame while the generation keeps prior-frame totals inert.
const frameOwnerStats = new Map<string, FrameWorkOwnerStat>();

export function getCurrentFrameWorkOwner(): string | null {
  return currentOwner;
}

export function runWithFrameWorkOwner<T>(owner: string, work: () => T, now: () => number = defaultNow): T {
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

export function consumeDominantFrameWorkOwner(): DominantFrameWorkOwner | null {
  let dominantOwner: string | null = null;
  let dominantStat: FrameWorkOwnerStat | null = null;

  frameOwnerStats.forEach((stat, owner) => {
    if (stat.frameGeneration !== frameGeneration) {
      return;
    }

    if (
      dominantStat === null ||
      stat.durationMs > dominantStat.durationMs ||
      (stat.durationMs === dominantStat.durationMs && stat.lastSequence > dominantStat.lastSequence)
    ) {
      dominantOwner = owner;
      dominantStat = stat;
    }
  });
  frameGeneration += 1;
  if (dominantOwner === null || dominantStat === null) return null;
  const stat = dominantStat as FrameWorkOwnerStat;
  return { durationMs: stat.durationMs, maxCallMs: stat.maxCallMs, owner: dominantOwner };
}

function recordFrameWorkOwner(owner: string, durationMs: number): void {
  const stat = frameOwnerStats.get(owner) ?? {
    durationMs: 0,
    frameGeneration,
    lastSequence: 0,
    maxCallMs: 0,
  };
  if (stat.frameGeneration !== frameGeneration) {
    stat.durationMs = 0;
    stat.frameGeneration = frameGeneration;
    stat.maxCallMs = 0;
  }
  stat.durationMs += durationMs;
  stat.maxCallMs = Math.max(stat.maxCallMs, durationMs);
  stat.lastSequence = ++ownerSequence;
  frameOwnerStats.set(owner, stat);
}

function defaultNow(): number {
  return performance.now();
}
