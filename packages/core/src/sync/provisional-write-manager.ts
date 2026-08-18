import type {
  GameSyncAuthoritativeObservation,
  GameSyncProvisionalIntentPhaseInfo,
  GameSyncProvisionalIntentStalledInfo,
  GameSyncProvisionalWrite,
  GameSyncStore,
} from "./game-sync-types";

type ProvisionalIntentStatus = "submitting" | "pending" | "confirmed" | "settled" | "failed";
export type ProvisionalIntentOutcome = "settled" | "failed" | "stalled";
export type ProvisionalIntentLockUntil = "transaction-hash" | "settled";

export interface ProvisionalIntent {
  bindTransaction(transactionHash?: string): void;
  confirm(): void;
  fail(): void;
  subscribe(listener: (outcome: ProvisionalIntentOutcome) => void): () => void;
}

interface TrackedWrite extends GameSyncProvisionalWrite {
  authoritativePatch: Record<string, unknown> | null | undefined;
  matched: boolean;
  sourceMatched: boolean;
  authoritativeBaseline?: Record<string, unknown> | null;
}

interface TrackedIntent {
  id: string;
  status: ProvisionalIntentStatus;
  transactionHash?: string;
  writes: TrackedWrite[];
  releaseTimeout: ReturnType<typeof setTimeout> | null;
  stalledTimeout: ReturnType<typeof setTimeout> | null;
  lockUntil: ProvisionalIntentLockUntil;
  createdAtMs: number;
  transactionHashAtMs?: number;
  hasReportedAuthoritativeEcho: boolean;
  outcomeListeners: Set<(outcome: ProvisionalIntentOutcome) => void>;
}

interface ProvisionalWriteManagerOptions {
  onIntentStalled?: (info: GameSyncProvisionalIntentStalledInfo) => void;
  onIntentPhase?: (info: GameSyncProvisionalIntentPhaseInfo) => void;
}

interface CreateProvisionalIntentOptions {
  lockUntil?: ProvisionalIntentLockUntil;
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
  private readonly onIntentStalled?: (info: GameSyncProvisionalIntentStalledInfo) => void;
  private readonly onIntentPhase?: (info: GameSyncProvisionalIntentPhaseInfo) => void;
  private readonly stateListeners = new Set<() => void>();
  private nextIntentId = 1;

  constructor(
    private readonly store: GameSyncStore,
    options: ProvisionalWriteManagerOptions = {},
  ) {
    this.onIntentStalled = options.onIntentStalled;
    this.onIntentPhase = options.onIntentPhase;
  }

  public createIntent(
    writes: readonly GameSyncProvisionalWrite[],
    options: CreateProvisionalIntentOptions = {},
  ): ProvisionalIntent {
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
        authoritativeBaseline: this.captureAuthoritativeBaseline(write),
        matched: write.matchPatch === undefined && !write.baselineDeltaFields?.length,
        sourceMatched: false,
      })),
      releaseTimeout: null,
      stalledTimeout: null,
      lockUntil: options.lockUntil ?? "transaction-hash",
      createdAtMs: Date.now(),
      hasReportedAuthoritativeEcho: false,
      outcomeListeners: new Set(),
    };
    if (!tracked.writes.some((write) => this.hasAuthoritativeEvidence(write))) {
      throw new Error("A provisional intent requires at least one authoritative match field");
    }
    this.intents.set(id, tracked);
    this.store.applyProvisionalWrites?.(id, writes);
    this.reportIntentPhase(tracked, "created");
    this.publishState();
    return this.createHandle(tracked);
  }

  public subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public observeAuthoritativeObservations(observations: readonly GameSyncAuthoritativeObservation[]): void {
    observations.forEach((observation) => this.observeAuthoritativeObservation(observation));
  }

  public hasInputLock(model: string, entityId: string): boolean {
    return [...this.intents.values()].some(
      (intent) =>
        this.isIntentInputLocked(intent) &&
        intent.writes.some((write) => modelName(write.model) === modelName(model) && write.entityId === entityId),
    );
  }

  /**
   * True while a live intent overlays this row and the chain has no
   * authoritative value for it yet — i.e. the row exists only optimistically
   * (a pending creation), as opposed to an overlay on top of a real row.
   */
  public isProvisionalOnly(model: string, entityId: string): boolean {
    const hasLiveWrite = [...this.intents.values()].some((intent) =>
      intent.writes.some((write) => modelName(write.model) === modelName(model) && write.entityId === entityId),
    );
    if (!hasLiveWrite) return false;
    const authoritative = this.store.readAuthoritativeModel?.(model, entityId);
    return authoritative === null || authoritative === undefined;
  }

  public dispose(): void {
    [...this.intents.values()].forEach((intent) => this.finishIntent(intent, "failed"));
  }

  private createHandle(intent: TrackedIntent): ProvisionalIntent {
    return {
      bindTransaction: (transactionHash) => {
        if (intent.status !== "submitting") return;
        intent.transactionHash = transactionHash;
        intent.transactionHashAtMs = Date.now();
        intent.status = "pending";
        this.reportIntentPhase(intent, "transaction_hash");
        this.publishState();
      },
      confirm: () => {
        if (intent.status === "settled" || intent.status === "failed") return;
        intent.status = "confirmed";
        this.scheduleStalledIntentTripwire(intent);
        this.scheduleReleaseWhenReconciled(intent);
        this.publishState();
      },
      fail: () => this.finishIntent(intent, "failed"),
      subscribe: (listener) => {
        intent.outcomeListeners.add(listener);
        return () => intent.outcomeListeners.delete(listener);
      },
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
    // A match is sticky: once the predicted state has been observed the write
    // is settled evidence. A later echo diverging from it is another action's
    // outcome (e.g. the next placement bumping packed counts), not an un-match.
    write.matched = write.matched || this.matchesAuthoritativeEvidence(intent, write, authoritativePatch);
    write.sourceMatched = write.sourcePatch ? matchesPatch(authoritativePatch, write.sourcePatch) : false;
    if (this.hasMatchedAuthoritativeEvidence(write)) this.reportFirstAuthoritativeEcho(intent, write.model);
    this.cancelScheduledRelease(intent);
    this.scheduleReleaseWhenReconciled(intent);
  }

  private scheduleReleaseWhenReconciled(intent: TrackedIntent): void {
    if (intent.status !== "confirmed" || !this.hasReconciledOutcome(intent)) return;
    intent.releaseTimeout = setTimeout(() => this.finishIntent(intent, "settled"), PROVISIONAL_RECONCILIATION_HOLD_MS);
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
    this.publishOutcome(intent, status);
    this.publishState();
  }

  private cancelScheduledRelease(intent: TrackedIntent): void {
    if (!intent.releaseTimeout) return;
    clearTimeout(intent.releaseTimeout);
    intent.releaseTimeout = null;
  }

  private scheduleStalledIntentTripwire(intent: TrackedIntent): void {
    if (intent.stalledTimeout) return;
    intent.stalledTimeout = setTimeout(() => {
      intent.stalledTimeout = null;
      if (intent.status !== "confirmed") return;
      // A sourceMatched flap can cancel a scheduled release without another
      // observation ever re-scheduling it — re-check before declaring a stall
      // so a reconciled intent settles instead of being force-failed.
      if (this.hasReconciledOutcome(intent)) {
        this.finishIntent(intent, "settled");
        return;
      }
      this.onIntentStalled?.(this.describeStalledIntent(intent));
      this.publishOutcome(intent, "stalled");
      this.finishIntent(intent, "failed");
    }, PROVISIONAL_STALLED_INTENT_MS);
  }

  private cancelStalledIntentTripwire(intent: TrackedIntent): void {
    if (!intent.stalledTimeout) return;
    clearTimeout(intent.stalledTimeout);
    intent.stalledTimeout = null;
  }

  private describeStalledIntent(intent: TrackedIntent): GameSyncProvisionalIntentStalledInfo {
    return {
      intentId: intent.id,
      transactionHash: intent.transactionHash,
      unmatchedWrites: intent.writes
        .filter((write) => this.hasAuthoritativeEvidence(write) && !write.matched && !write.sourceMatched)
        .map((write) => ({
          entityId: write.entityId,
          model: write.model,
          matchPatch: write.matchPatch,
          sourcePatch: write.sourcePatch,
          baselineDeltaFields: write.baselineDeltaFields,
        })),
    };
  }

  private captureAuthoritativeBaseline(write: GameSyncProvisionalWrite): Record<string, unknown> | null | undefined {
    if (!write.baselineDeltaFields?.length) return undefined;
    if (!this.store.readAuthoritativeModel) {
      throw new Error("The active game sync store cannot capture authoritative baseline evidence");
    }
    const value = this.store.readAuthoritativeModel(write.model, write.entityId);
    if (!value) return null;
    return Object.fromEntries(write.baselineDeltaFields.map((field) => [field, value[field]]));
  }

  private hasAuthoritativeEvidence(write: TrackedWrite): boolean {
    return Boolean(
      write.matchPatch !== undefined || write.sourcePatch !== undefined || write.baselineDeltaFields?.length,
    );
  }

  private matchesAuthoritativeEvidence(
    intent: TrackedIntent,
    write: TrackedWrite,
    authoritativePatch: Record<string, unknown> | null,
  ): boolean {
    if (write.baselineDeltaFields?.length) {
      if (intent.transactionHashAtMs === undefined) return false;
      return write.baselineDeltaFields.some(
        (field) => !matchesPatch(authoritativePatch?.[field], write.authoritativeBaseline?.[field]),
      );
    }
    return write.matchPatch === undefined || matchesPatch(authoritativePatch, write.matchPatch);
  }

  private hasMatchedAuthoritativeEvidence(write: TrackedWrite): boolean {
    const exactMatched = write.matchPatch !== undefined && write.matched;
    const baselineDeltaMatched = Boolean(write.baselineDeltaFields?.length && write.matched);
    return exactMatched || baselineDeltaMatched || write.sourceMatched;
  }

  private isIntentInputLocked(intent: TrackedIntent): boolean {
    return intent.lockUntil === "settled" || intent.status === "submitting";
  }

  private publishState(): void {
    this.stateListeners.forEach((listener) => listener());
  }

  private publishOutcome(intent: TrackedIntent, outcome: ProvisionalIntentOutcome): void {
    intent.outcomeListeners.forEach((listener) => listener(outcome));
  }

  private reportFirstAuthoritativeEcho(intent: TrackedIntent, model: string): void {
    if (intent.hasReportedAuthoritativeEcho) return;
    intent.hasReportedAuthoritativeEcho = true;
    this.reportIntentPhase(intent, "authoritative_echo", model);
  }

  private reportIntentPhase(
    intent: TrackedIntent,
    phase: GameSyncProvisionalIntentPhaseInfo["phase"],
    model?: string,
  ): void {
    const now = Date.now();
    this.onIntentPhase?.({
      phase,
      intentId: intent.id,
      transactionHash: intent.transactionHash,
      model,
      elapsedSinceCreatedMs: now - intent.createdAtMs,
      elapsedSinceTransactionHashMs:
        intent.transactionHashAtMs === undefined ? undefined : now - intent.transactionHashAtMs,
    });
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
