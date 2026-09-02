interface FrameWorkOwnerStat {
  durationMs: number;
  frameGeneration: number;
  lastSequence: number;
}

/** The owner that accounted for the most attributed time in the frame, with that time. */
export interface DominantFrameWorkOwner {
  durationMs: number;
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
  return dominantOwner === null || dominantStat === null
    ? null
    : { durationMs: (dominantStat as FrameWorkOwnerStat).durationMs, owner: dominantOwner };
}

function recordFrameWorkOwner(owner: string, durationMs: number): void {
  const stat = frameOwnerStats.get(owner) ?? {
    durationMs: 0,
    frameGeneration,
    lastSequence: 0,
  };
  if (stat.frameGeneration !== frameGeneration) {
    stat.durationMs = 0;
    stat.frameGeneration = frameGeneration;
  }
  stat.durationMs += durationMs;
  stat.lastSequence = ++ownerSequence;
  frameOwnerStats.set(owner, stat);
}

function defaultNow(): number {
  return performance.now();
}
