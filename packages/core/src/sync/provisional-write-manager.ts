import type {
  GameSyncAuthoritativeObservation,
  GameSyncProvisionalIntentStalledInfo,
  GameSyncProvisionalWrite,
  GameSyncStore,
} from "./game-sync-types";

export type ProvisionalIntentStatus = "submitting" | "pending" | "confirmed" | "settled" | "failed";

export interface ProvisionalIntent {
  readonly id: string;
  readonly status: ProvisionalIntentStatus;
  readonly transactionHash?: string;
  isInputLocked(): boolean;
  bindTransaction(transactionHash?: string): void;
  confirm(): void;
  fail(): void;
}

interface TrackedWrite extends GameSyncProvisionalWrite {
  authoritativePatch: Record<string, unknown> | null | undefined;
  matched: boolean;
  sourceMatched: boolean;
}

interface TrackedIntent {
  id: string;
  status: ProvisionalIntentStatus;
  transactionHash?: string;
  writes: TrackedWrite[];
  releaseTimeout: ReturnType<typeof setTimeout> | null;
  stalledTimeout: ReturnType<typeof setTimeout> | null;
}

interface ProvisionalWriteManagerOptions {
  reconciliationHoldMs?: number;
  stalledIntentMs?: number;
  onIntentStalled?: (info: GameSyncProvisionalIntentStalledInfo) => void;
  scheduleTimeout?: (task: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  cancelTimeout?: (timeout: ReturnType<typeof setTimeout>) => void;
}

const PROVISIONAL_RECONCILIATION_HOLD_MS = 2_500;
const PROVISIONAL_STALLED_INTENT_MS = 30_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergePatch = (current: unknown, next: unknown): unknown => {
  if (!isRecord(current) || !isRecord(next)) return next;
  return Object.fromEntries(
    [...new Set([...Object.keys(current), ...Object.keys(next)])].map((key) => [
      key,
      key in next ? mergePatch(current[key], next[key]) : current[key],
    ]),
  );
};

const matchesPatch = (authoritative: unknown, patch: unknown): boolean => {
  if (Array.isArray(patch)) {
    return (
      Array.isArray(authoritative) &&
      authoritative.length === patch.length &&
      patch.every((value, index) => matchesPatch(authoritative[index], value))
    );
  }
  if (isRecord(patch)) {
    return (
      isRecord(authoritative) && Object.entries(patch).every(([key, value]) => matchesPatch(authoritative[key], value))
    );
  }
  return Object.is(authoritative, patch);
};

const modelName = (qualifiedModel: string): string => qualifiedModel.slice(qualifiedModel.lastIndexOf("-") + 1);

export class ProvisionalWriteManager {
  private readonly intents = new Map<string, TrackedIntent>();
  private readonly reconciliationHoldMs: number;
  private readonly stalledIntentMs: number;
  private readonly onIntentStalled?: (info: GameSyncProvisionalIntentStalledInfo) => void;
  private readonly scheduleTimeout: NonNullable<ProvisionalWriteManagerOptions["scheduleTimeout"]>;
  private readonly cancelTimeout: NonNullable<ProvisionalWriteManagerOptions["cancelTimeout"]>;
  private nextIntentId = 1;

  constructor(
    private readonly store: GameSyncStore,
    options: ProvisionalWriteManagerOptions = {},
  ) {
    this.reconciliationHoldMs = options.reconciliationHoldMs ?? PROVISIONAL_RECONCILIATION_HOLD_MS;
    this.stalledIntentMs = options.stalledIntentMs ?? PROVISIONAL_STALLED_INTENT_MS;
    this.onIntentStalled = options.onIntentStalled;
    this.scheduleTimeout = options.scheduleTimeout ?? ((task, delayMs) => setTimeout(task, delayMs));
    this.cancelTimeout = options.cancelTimeout ?? ((timeout) => clearTimeout(timeout));
  }

  public createIntent(writes: readonly GameSyncProvisionalWrite[]): ProvisionalIntent {
    if (writes.length === 0) throw new Error("A provisional intent requires at least one write");
    if (!this.store.applyProvisionalWrites || !this.store.removeProvisionalWrites) {
      throw new Error("The active game sync store does not support provisional writes");
    }

    const id = `game-sync-provisional-${this.nextIntentId++}`;
    const tracked: TrackedIntent = {
      id,
      status: "submitting",
      writes: writes.map((write) => ({
        ...write,
        authoritativePatch: undefined,
        matched: write.matchPatch === undefined,
        sourceMatched: false,
      })),
      releaseTimeout: null,
      stalledTimeout: null,
    };
    if (!tracked.writes.some((write) => write.matchPatch !== undefined || write.sourcePatch !== undefined)) {
      throw new Error("A provisional intent requires at least one authoritative match field");
    }
    this.intents.set(id, tracked);
    this.store.applyProvisionalWrites?.(id, writes);
    return this.createHandle(tracked);
  }

  public observeAuthoritativeObservations(observations: readonly GameSyncAuthoritativeObservation[]): void {
    observations.forEach((observation) => this.observeAuthoritativeObservation(observation));
  }

  public hasInputLock(model: string, entityId: string): boolean {
    return [...this.intents.values()].some(
      (intent) =>
        intent.status === "submitting" &&
        intent.writes.some((write) => modelName(write.model) === modelName(model) && write.entityId === entityId),
    );
  }

  public dispose(): void {
    [...this.intents.values()].forEach((intent) => this.finishIntent(intent, "failed"));
  }

  private createHandle(intent: TrackedIntent): ProvisionalIntent {
    return {
      id: intent.id,
      get status() {
        return intent.status;
      },
      get transactionHash() {
        return intent.transactionHash;
      },
      // Input locks only while no transaction hash exists — the sole window
      // where a second submission would double-spend. Once the hash is bound
      // the move is nonce-committed: chaining is valid, the overlay models the
      // outcome, and a revert unwinds through fail(). Input never waits on
      // receipts, block cadence, or torii.
      isInputLocked: () => intent.status === "submitting",
      bindTransaction: (transactionHash) => {
        if (intent.status !== "submitting") return;
        intent.transactionHash = transactionHash;
        intent.status = "pending";
      },
      confirm: () => {
        if (intent.status === "settled" || intent.status === "failed") return;
        intent.status = "confirmed";
        this.scheduleStalledIntentTripwire(intent);
        this.scheduleReleaseWhenReconciled(intent);
      },
      fail: () => this.finishIntent(intent, "failed"),
    };
  }

  private observeAuthoritativeObservation(observation: GameSyncAuthoritativeObservation): void {
    if (observation.type === "model") {
      this.observeAuthoritativePatch(observation.entityId, modelName(observation.model), observation.value);
      return;
    }

    this.intents.forEach((intent) => {
      intent.writes.forEach((write) => {
        if (write.entityId !== observation.entityId) return;
        this.updateWriteMatch(intent, write, null);
      });
    });
  }

  private observeAuthoritativePatch(entityId: string, model: string, patch: unknown): void {
    this.intents.forEach((intent) => {
      intent.writes.forEach((write) => {
        if (write.entityId !== entityId || modelName(write.model) !== model) return;
        const authoritativePatch = mergePatch(write.authoritativePatch, patch);
        this.updateWriteMatch(intent, write, isRecord(authoritativePatch) ? authoritativePatch : null);
      });
    });
  }

  private updateWriteMatch(
    intent: TrackedIntent,
    write: TrackedWrite,
    authoritativePatch: Record<string, unknown> | null,
  ): void {
    write.authoritativePatch = authoritativePatch;
    write.matched = write.matchPatch === undefined || matchesPatch(authoritativePatch, write.matchPatch);
    write.sourceMatched = write.sourcePatch ? matchesPatch(authoritativePatch, write.sourcePatch) : false;
    this.cancelScheduledRelease(intent);
    this.scheduleReleaseWhenReconciled(intent);
  }

  private scheduleReleaseWhenReconciled(intent: TrackedIntent): void {
    if (intent.status !== "confirmed" || !this.hasReconciledOutcome(intent)) return;
    intent.releaseTimeout = this.scheduleTimeout(() => this.finishIntent(intent, "settled"), this.reconciliationHoldMs);
  }

  private hasReconciledOutcome(intent: TrackedIntent): boolean {
    if (intent.writes.every((write) => write.matched)) return true;
    const hasSourceOutcome = intent.writes.some((write) => write.sourcePatch);
    return hasSourceOutcome && intent.writes.every((write) => write.matched || write.sourceMatched);
  }

  private finishIntent(intent: TrackedIntent, status: "settled" | "failed"): void {
    if (!this.intents.has(intent.id)) return;
    this.cancelScheduledRelease(intent);
    this.cancelStalledIntentTripwire(intent);
    intent.status = status;
    this.store.removeProvisionalWrites?.(intent.id);
    this.intents.delete(intent.id);
  }

  private cancelScheduledRelease(intent: TrackedIntent): void {
    if (!intent.releaseTimeout) return;
    this.cancelTimeout(intent.releaseTimeout);
    intent.releaseTimeout = null;
  }

  private scheduleStalledIntentTripwire(intent: TrackedIntent): void {
    if (!this.onIntentStalled || intent.stalledTimeout) return;
    intent.stalledTimeout = this.scheduleTimeout(() => {
      intent.stalledTimeout = null;
      if (intent.status !== "confirmed") return;
      this.onIntentStalled?.(this.describeStalledIntent(intent));
    }, this.stalledIntentMs);
  }

  private cancelStalledIntentTripwire(intent: TrackedIntent): void {
    if (!intent.stalledTimeout) return;
    this.cancelTimeout(intent.stalledTimeout);
    intent.stalledTimeout = null;
  }

  private describeStalledIntent(intent: TrackedIntent): GameSyncProvisionalIntentStalledInfo {
    return {
      intentId: intent.id,
      transactionHash: intent.transactionHash,
      unmatchedWrites: intent.writes
        .filter((write) => write.matchPatch !== undefined && !write.matched && !write.sourceMatched)
        .map((write) => ({
          entityId: write.entityId,
          model: write.model,
          matchPatch: write.matchPatch as Record<string, unknown> | null,
          sourcePatch: write.sourcePatch,
        })),
    };
  }
}

interface TransactionWaiterSource {
  waitForTransaction?: (transactionHash: string) => Promise<unknown>;
  waitForTransactionWithCheck?: (transactionHash: string) => Promise<unknown>;
  provider?: TransactionWaiterSource;
}

const extractProvisionalTransactionHash = (result: unknown): string | undefined => {
  if (!isRecord(result)) return undefined;
  const transactionHash = result.transaction_hash ?? result.transactionHash;
  return typeof transactionHash === "string" ? transactionHash : undefined;
};

const resolveTransactionWaiter = (source: unknown): ((transactionHash: string) => Promise<unknown>) | null => {
  if (!isRecord(source)) return null;
  const waiterSource = source as TransactionWaiterSource;
  if (typeof waiterSource.provider?.waitForTransactionWithCheck === "function") {
    return waiterSource.provider.waitForTransactionWithCheck.bind(waiterSource.provider);
  }
  if (typeof waiterSource.waitForTransactionWithCheck === "function") {
    return waiterSource.waitForTransactionWithCheck.bind(waiterSource);
  }
  if (typeof waiterSource.waitForTransaction === "function") {
    return waiterSource.waitForTransaction.bind(waiterSource);
  }
  if (typeof waiterSource.provider?.waitForTransaction === "function") {
    return waiterSource.provider.waitForTransaction.bind(waiterSource.provider);
  }
  return null;
};

const transactionReverted = (receipt: unknown): boolean =>
  isRecord(receipt) && typeof receipt.isReverted === "function" && receipt.isReverted() === true;

export const trackProvisionalTransaction = (
  intent: ProvisionalIntent,
  waiterSource: unknown,
  transactionResult: unknown,
  callbacks: { onConfirmed?: () => void; onFailed?: () => void } = {},
): void => {
  const transactionHash = extractProvisionalTransactionHash(transactionResult);
  intent.bindTransaction(transactionHash);

  const waitForTransaction = resolveTransactionWaiter(waiterSource);
  if (!transactionHash || !waitForTransaction) {
    intent.confirm();
    callbacks.onConfirmed?.();
    return;
  }

  void waitForTransaction(transactionHash).then(
    (receipt) => {
      if (transactionReverted(receipt)) {
        intent.fail();
        callbacks.onFailed?.();
        return;
      }
      intent.confirm();
      callbacks.onConfirmed?.();
    },
    () => {
      intent.fail();
      callbacks.onFailed?.();
    },
  );
};
