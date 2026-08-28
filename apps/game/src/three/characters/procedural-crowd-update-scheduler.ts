export interface ProceduralCrowdUpdateSchedulerStats {
  activeLane: number;
  itemCount: number;
  laneCount: number;
}

interface ScheduledItemState {
  elapsedSeconds: number;
  sequence: number;
}

/**
 * Spreads pose work across deterministic lanes once a crowd is large enough.
 * Root movement remains render-rate; only articulated pose evaluation is
 * reduced, and ragdolls can opt into every-frame synchronization.
 */
export class ProceduralCrowdUpdateScheduler<Item> {
  private readonly items = new Map<Item, ScheduledItemState>();
  private activeLane = 0;
  private nextSequence = 0;
  private laneCount: number;

  public constructor(
    laneCount = 3,
    private readonly minimumCrowdSize = 48,
  ) {
    this.laneCount = normalizeLaneCount(laneCount);
  }

  public add(item: Item): void {
    if (this.items.has(item)) return;
    this.items.set(item, { elapsedSeconds: 0, sequence: this.nextSequence++ });
  }

  public delete(item: Item): void {
    this.items.delete(item);
  }

  public clear(): void {
    this.items.clear();
    this.activeLane = 0;
    this.nextSequence = 0;
  }

  public setLaneCount(laneCount: number): void {
    this.laneCount = normalizeLaneCount(laneCount);
    this.activeLane %= this.laneCount;
  }

  public update(
    deltaSeconds: number,
    isAlwaysDue: (item: Item) => boolean,
    updateItem: (item: Item, elapsedSeconds: number) => void,
  ): void {
    const elapsed = normalizeDeltaSeconds(deltaSeconds);
    const effectiveLaneCount = this.resolveEffectiveLaneCount();
    const lane = effectiveLaneCount === 1 ? 0 : this.activeLane;

    this.items.forEach((state, item) => {
      state.elapsedSeconds = Math.min(0.1, state.elapsedSeconds + elapsed);
      if (elapsed > 0 && !isAlwaysDue(item) && state.sequence % effectiveLaneCount !== lane) return;
      updateItem(item, state.elapsedSeconds);
      state.elapsedSeconds = 0;
    });

    this.activeLane = (lane + 1) % effectiveLaneCount;
  }

  public getStats(): ProceduralCrowdUpdateSchedulerStats {
    return {
      activeLane: this.activeLane,
      itemCount: this.items.size,
      laneCount: this.resolveEffectiveLaneCount(),
    };
  }

  private resolveEffectiveLaneCount(): number {
    return this.items.size >= this.minimumCrowdSize ? this.laneCount : 1;
  }
}

function normalizeLaneCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.round(value)));
}

function normalizeDeltaSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.1, Math.max(0, value));
}
