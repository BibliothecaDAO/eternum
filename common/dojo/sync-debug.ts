export type SyncGuardState = "streaming" | "lagging" | "replaying" | "error";

export interface SyncGuardSnapshot {
  state: SyncGuardState;
  lastAppliedAt: number;
  lastAppliedBlock?: string;
  isReplaying: boolean;
  replayAttempts: number;
}

export interface SyncQueueStats {
  queuedCount: number;
  pendingCount: number;
  queuedEntityIds: string[];
  pendingEntityIds: string[];
}

export interface SyncLedgerSnapshotOptions {
  entityId?: string;
  limit?: number;
}

export interface SyncLedgerSnapshotEntry {
  entityId: string;
  blockNumber?: string;
  eventIndex?: number;
  isDeleted: boolean;
  components: Record<string, string>;
}

export interface SyncLedgerSnapshot {
  total: number;
  entries: SyncLedgerSnapshotEntry[];
}

interface GuardContext {
  getState(): SyncGuardState;
  getSnapshot(): {
    state: SyncGuardState;
    lastAppliedAt: number;
    lastAppliedBlock?: bigint;
    isReplaying: boolean;
    replayAttempts: number;
  };
  forceReplay(): Promise<void>;
}

export interface SyncDebugContext {
  enabled: boolean;
  identifier: string;
  guard: GuardContext;
  cancel(): void;
  queue(): SyncQueueStats;
  ledgerSnapshot(options?: SyncLedgerSnapshotOptions): SyncLedgerSnapshot;
  extras?(): Record<string, unknown>;
}

interface SyncDebugEntry {
  id: string;
  state(): SyncGuardState;
  snapshot(): SyncGuardSnapshot;
  queue(): SyncQueueStats;
  ledger(options?: SyncLedgerSnapshotOptions): SyncLedgerSnapshot;
  forceReplay(): Promise<void>;
  cancel(): void;
  extras(): Record<string, unknown>;
}

interface SyncDebugRoot {
  entries: Map<string, SyncDebugEntry>;
  list(): string[];
  get(id: string): SyncDebugEntry | undefined;
  remove(id: string): void;
  snapshot(): Record<string, unknown>;
}

const ensureRoot = (): SyncDebugRoot | null => {
  if (typeof window === "undefined") return null;
  const global = window as unknown as { __SYNC_DEBUG__?: SyncDebugRoot };
  if (global.__SYNC_DEBUG__) return global.__SYNC_DEBUG__;

  const root: SyncDebugRoot = {
    entries: new Map<string, SyncDebugEntry>(),
    list() {
      return Array.from(this.entries.keys());
    },
    get(id: string) {
      return this.entries.get(id);
    },
    remove(id: string) {
      this.entries.delete(id);
    },
    snapshot() {
      const summary: Record<string, unknown> = {};
      for (const [id, entry] of this.entries.entries()) {
        summary[id] = {
          state: entry.state(),
          queue: entry.queue(),
          guard: entry.snapshot(),
          extras: entry.extras(),
        };
      }
      return summary;
    },
  };

  Object.defineProperty(global, "__SYNC_DEBUG__", {
    value: root,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return root;
};

const createEntry = (ctx: SyncDebugContext): SyncDebugEntry => {
  const extras = ctx.extras ?? (() => ({}));
  return {
    id: ctx.identifier,
    state: () => ctx.guard.getState(),
    snapshot: () => {
      const internal = ctx.guard.getSnapshot();
      return {
        state: internal.state,
        lastAppliedAt: internal.lastAppliedAt,
        lastAppliedBlock: internal.lastAppliedBlock?.toString(),
        isReplaying: internal.isReplaying,
        replayAttempts: internal.replayAttempts,
      } satisfies SyncGuardSnapshot;
    },
    queue: () => ctx.queue(),
    ledger: (options) => ctx.ledgerSnapshot(options),
    forceReplay: () => ctx.guard.forceReplay(),
    cancel: () => ctx.cancel(),
    extras,
  };
};

export const attachSyncDebug = (ctx: SyncDebugContext): (() => void) => {
  if (!ctx.enabled) return () => {};
  const root = ensureRoot();
  if (!root) return () => {};

  const entry = createEntry(ctx);
  if (root.entries.has(ctx.identifier)) {
    root.entries.delete(ctx.identifier);
  }
  root.entries.set(ctx.identifier, entry);

  if (ctx.enabled) {
    // eslint-disable-next-line no-console
    console.info(`[sync-debug] attached ${ctx.identifier}`);
  }

  return () => {
    if (root.entries.get(ctx.identifier) === entry) {
      root.entries.delete(ctx.identifier);
      // eslint-disable-next-line no-console
      console.info(`[sync-debug] detached ${ctx.identifier}`);
    }
  };
};
