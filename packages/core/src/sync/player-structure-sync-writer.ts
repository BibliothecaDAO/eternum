import type { GameSyncWriter } from "./game-sync-runtime";

export interface PlayerStructureSyncTarget {
  entityId: number;
  position: { col: number; row: number };
}

interface OwnedStructureLocation {
  entity_id: unknown;
  coord_x: unknown;
  coord_y: unknown;
}

export interface PlayerStructureSyncWriterDependencies {
  fetchOwnedStructures: () => Promise<OwnedStructureLocation[]>;
  hydrateStructures: (targets: readonly PlayerStructureSyncTarget[]) => Promise<void>;
  subscribeToOwnerChanges: (onOwnerChange: () => void) => Promise<GameSyncWriter>;
  subscribeToPlayerState: (targets: readonly PlayerStructureSyncTarget[]) => Promise<GameSyncWriter>;
  reconciliationIntervalMs: number;
  backfillDebounceMs?: number;
  onError?: (operation: string, error: unknown) => void;
}

const DEFAULT_BACKFILL_DEBOUNCE_MS = 250;

export const selectUnsyncedOwnedStructureTargets = ({
  ownedStructures,
  currentPlayerStructureIds,
  inFlightStructureIds,
}: {
  ownedStructures: readonly OwnedStructureLocation[];
  currentPlayerStructureIds: ReadonlySet<number>;
  inFlightStructureIds: ReadonlySet<number>;
}): PlayerStructureSyncTarget[] => {
  const seenEntityIds = new Set<number>();

  return ownedStructures.reduce<PlayerStructureSyncTarget[]>((targets, structure) => {
    const entityId = Number(structure.entity_id);
    const col = Number(structure.coord_x);
    const row = Number(structure.coord_y);

    if (!Number.isFinite(entityId) || !Number.isFinite(col) || !Number.isFinite(row)) {
      return targets;
    }
    if (seenEntityIds.has(entityId)) {
      return targets;
    }

    seenEntityIds.add(entityId);
    if (currentPlayerStructureIds.has(entityId) || inFlightStructureIds.has(entityId)) {
      return targets;
    }

    targets.push({ entityId, position: { col, row } });
    return targets;
  }, []);
};

/** Owns the legacy player-scoped writer until S2's game-wide stream retires it. */
export class PlayerStructureSyncWriter implements GameSyncWriter {
  private active = false;
  private backfillRunning = false;
  private rerunBackfill = false;
  private ownerSubscription: GameSyncWriter | null = null;
  private ownerSubscriptionGeneration = 0;
  private playerSubscription: GameSyncWriter | null = null;
  private playerSubscriptionGeneration = 0;
  private backfillTimer: ReturnType<typeof setTimeout> | null = null;
  private reconciliationTimer: ReturnType<typeof setInterval> | null = null;
  private targets: readonly PlayerStructureSyncTarget[] = [];
  private readonly syncedStructureIds = new Set<number>();
  private readonly inFlightStructureIds = new Set<number>();

  constructor(private readonly dependencies: PlayerStructureSyncWriterDependencies) {}

  public start(targets: readonly PlayerStructureSyncTarget[]): void {
    if (this.active) {
      this.updateTargets(targets);
      return;
    }

    this.active = true;
    this.targets = targets;
    void this.openOwnerSubscription();
    void this.replacePlayerSubscription();
    void this.hydrateNewlySeenTargets();
    void this.backfillOwnedStructures();
    this.reconciliationTimer = setInterval(
      () => this.requestOwnedStructureBackfill(),
      this.dependencies.reconciliationIntervalMs,
    );
  }

  public updateTargets(targets: readonly PlayerStructureSyncTarget[]): void {
    this.targets = targets;
    if (!this.active) {
      return;
    }

    void this.replacePlayerSubscription();
    void this.hydrateNewlySeenTargets();
  }

  public reconnect(): void {
    if (!this.active) {
      return;
    }

    this.ownerSubscription?.cancel();
    this.ownerSubscription = null;
    void this.openOwnerSubscription();
    void this.replacePlayerSubscription();
    this.clearBackfillTimer();
    void this.backfillOwnedStructures();
  }

  public cancel(): void {
    this.active = false;
    this.playerSubscriptionGeneration += 1;
    this.ownerSubscriptionGeneration += 1;
    this.clearBackfillTimer();
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
    this.ownerSubscription?.cancel();
    this.ownerSubscription = null;
    this.playerSubscription?.cancel();
    this.playerSubscription = null;
    this.rerunBackfill = false;
    this.inFlightStructureIds.clear();
  }

  private async openOwnerSubscription(): Promise<void> {
    const generation = ++this.ownerSubscriptionGeneration;
    try {
      const subscription = await this.dependencies.subscribeToOwnerChanges(() => this.requestOwnedStructureBackfill());
      if (!this.active || generation !== this.ownerSubscriptionGeneration) {
        subscription.cancel();
        return;
      }
      this.ownerSubscription?.cancel();
      this.ownerSubscription = subscription;
    } catch (error) {
      this.reportError("subscribe to owned structure updates", error);
    }
  }

  private async replacePlayerSubscription(): Promise<void> {
    const generation = ++this.playerSubscriptionGeneration;
    this.playerSubscription?.cancel();
    this.playerSubscription = null;

    try {
      const subscription = await this.dependencies.subscribeToPlayerState(this.targets);
      if (!this.active || generation !== this.playerSubscriptionGeneration) {
        subscription.cancel();
        return;
      }
      this.playerSubscription = subscription;
    } catch (error) {
      this.reportError("subscribe to player structure updates", error);
    }
  }

  private requestOwnedStructureBackfill(): void {
    if (!this.active) {
      return;
    }
    if (this.backfillRunning) {
      this.rerunBackfill = true;
      return;
    }
    if (this.backfillTimer) {
      return;
    }

    this.backfillTimer = setTimeout(() => {
      this.backfillTimer = null;
      void this.backfillOwnedStructures();
    }, this.dependencies.backfillDebounceMs ?? DEFAULT_BACKFILL_DEBOUNCE_MS);
  }

  private async backfillOwnedStructures(): Promise<void> {
    if (!this.active || this.backfillRunning) {
      this.rerunBackfill = this.active;
      return;
    }

    this.backfillRunning = true;
    this.rerunBackfill = false;
    let claimedIds: number[] = [];

    try {
      const ownedStructures = await this.dependencies.fetchOwnedStructures();
      if (!this.active) {
        return;
      }

      const targets = selectUnsyncedOwnedStructureTargets({
        ownedStructures,
        currentPlayerStructureIds: new Set(this.targets.map(({ entityId }) => entityId)),
        inFlightStructureIds: this.inFlightStructureIds,
      });
      claimedIds = this.claimTargets(targets);
      if (targets.length === 0) {
        return;
      }

      await this.dependencies.hydrateStructures(targets);
      if (this.active) {
        claimedIds.forEach((entityId) => this.syncedStructureIds.add(entityId));
      }
    } catch (error) {
      this.reportError("backfill owned structures", error);
    } finally {
      claimedIds.forEach((entityId) => this.inFlightStructureIds.delete(entityId));
      this.backfillRunning = false;
      if (this.active && this.rerunBackfill) {
        this.requestOwnedStructureBackfill();
      }
    }
  }

  private async hydrateNewlySeenTargets(): Promise<void> {
    const targets = this.targets.filter(
      ({ entityId }) => !this.syncedStructureIds.has(entityId) && !this.inFlightStructureIds.has(entityId),
    );
    const claimedIds = this.claimTargets(targets);
    if (targets.length === 0) {
      return;
    }

    try {
      await this.dependencies.hydrateStructures(targets);
      if (this.active) {
        claimedIds.forEach((entityId) => this.syncedStructureIds.add(entityId));
      }
    } catch (error) {
      this.reportError("hydrate newly seen structures", error);
    } finally {
      claimedIds.forEach((entityId) => this.inFlightStructureIds.delete(entityId));
    }
  }

  private claimTargets(targets: readonly PlayerStructureSyncTarget[]): number[] {
    const claimedIds = targets.map(({ entityId }) => entityId);
    claimedIds.forEach((entityId) => this.inFlightStructureIds.add(entityId));
    return claimedIds;
  }

  private clearBackfillTimer(): void {
    if (!this.backfillTimer) {
      return;
    }
    clearTimeout(this.backfillTimer);
    this.backfillTimer = null;
  }

  private reportError(operation: string, error: unknown): void {
    this.dependencies.onError?.(operation, error);
  }
}
