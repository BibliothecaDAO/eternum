import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentRunJob } from "@bibliothecadao/types";
import type { AgentTurnResult } from "@bibliothecadao/agent-runtime";
import { ExecutorRunStore } from "./executor-run-store";

// Mock saveAgentArtifacts so persistRun doesn't hit the filesystem
vi.mock("@bibliothecadao/agent-runtime", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    saveAgentArtifacts: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock fs/promises so collectArtifacts doesn't hit the filesystem
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(""),
}));

/**
 * Creates a chainable mock that records calls and resolves to `result`.
 * Every property access returns the same chainable proxy, except the
 * final await (`.then`) which resolves with the configured result.
 */
function createChainableMock(result: unknown = []) {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<CallableFunction> = {
    get(_target, prop: string) {
      if (prop === "then") {
        // Make the proxy thenable so `await chain` resolves to `result`
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      // Return a function that records the call and returns the proxy again
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    },
    apply(_target, _thisArg, args) {
      calls.push({ method: "call", args });
      return proxy;
    },
  };

  const proxy: any = new Proxy(function () {}, handler);
  return { proxy, calls };
}

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  _selectChain: ReturnType<typeof createChainableMock>;
  _updateChain: ReturnType<typeof createChainableMock>;
  _insertChain: ReturnType<typeof createChainableMock>;
}

function createMockDb(overrides?: {
  selectResult?: unknown;
  updateResult?: unknown;
  insertResult?: unknown;
}): MockDb {
  const selectChain = createChainableMock(overrides?.selectResult ?? []);
  const updateChain = createChainableMock(overrides?.updateResult ?? []);
  const insertChain = createChainableMock(overrides?.insertResult ?? undefined);

  const db: any = {
    select: vi.fn((...args: unknown[]) => {
      selectChain.calls.push({ method: "select", args });
      return selectChain.proxy;
    }),
    update: vi.fn((...args: unknown[]) => {
      updateChain.calls.push({ method: "update", args });
      return updateChain.proxy;
    }),
    insert: vi.fn((...args: unknown[]) => {
      insertChain.calls.push({ method: "insert", args });
      return insertChain.proxy;
    }),
    transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => {
      // The tx object has the same interface. Create fresh chains for each tx call.
      const txSelectChain = createChainableMock([{ value: 0 }]);
      const txUpdateChain = createChainableMock([]);
      const txInsertChain = createChainableMock(undefined);
      const tx = {
        select: (...args: unknown[]) => {
          txSelectChain.calls.push({ method: "select", args });
          return txSelectChain.proxy;
        },
        update: (...args: unknown[]) => {
          txUpdateChain.calls.push({ method: "update", args });
          return txUpdateChain.proxy;
        },
        insert: (...args: unknown[]) => {
          txInsertChain.calls.push({ method: "insert", args });
          return txInsertChain.proxy;
        },
      };
      await cb(tx);
    }),
    _selectChain: selectChain,
    _updateChain: updateChain,
    _insertChain: insertChain,
  };

  return db;
}

function makeJob(overrides?: Partial<AgentRunJob>): AgentRunJob {
  return {
    jobId: "job-1",
    agentId: "agent-1",
    wakeReason: "scheduled_tick",
    coalescedEventIds: [],
    leaseId: "lease-1",
    priority: 1,
    requestedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTurnResult(overrides?: Partial<AgentTurnResult>): AgentTurnResult {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    toolCalls: 3,
    success: true,
    ...overrides,
  };
}

const mockArtifactStore = { save: vi.fn().mockResolvedValue(undefined), load: vi.fn() };

describe("ExecutorRunStore", () => {
  let db: MockDb;
  let store: ExecutorRunStore;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── claimDueAgentJobs ──────────────────────────────────────────────

  describe("claimDueAgentJobs", () => {
    it("returns [] when no agents are due (select returns empty)", async () => {
      db = createMockDb({ selectResult: [] });
      store = new ExecutorRunStore(db, mockArtifactStore as any);

      const jobs = await store.claimDueAgentJobs(new Date());

      expect(jobs).toEqual([]);
    });

    it("returns claimed jobs for agents in idle state with nextWakeAt <= now", async () => {
      const now = new Date();
      // First select (recoverStaleQueuedJobs) returns [], second (recoverStaleRunningJobs) returns [],
      // third (main query) returns agent rows.
      // We need to control select calls sequentially.
      let selectCallCount = 0;
      const agentRow = { id: "agent-1", nextWakeAt: new Date(now.getTime() - 1000) };

      const selectResults = [
        [], // recoverStaleQueuedJobs
        [], // recoverStaleRunningJobs
        [agentRow], // main due agents query
      ];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn(function (this: any) {
          return Promise.resolve(selectResults[selectCallCount++] ?? []);
        }),
        then: undefined as any,
      };
      // For calls without limit (recoverStale), resolve via orderBy
      selectChain.orderBy = vi.fn(function () {
        const idx = selectCallCount++;
        const result = selectResults[idx] ?? [];
        // Return thenable that also has .limit
        return {
          limit: vi.fn(() => Promise.resolve(selectResults[selectCallCount - 1] ?? result)),
          then: (resolve: any) => resolve(result),
        };
      });
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);

      // update.returning returns [{ id: "agent-1" }] for the claim
      const updateReturning = vi.fn().mockResolvedValue([{ id: "agent-1" }]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };

      const customDb: any = {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => updateChain),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        transaction: vi.fn(async (cb: any) => {
          const txSelect = createChainableMock([{ value: 0 }]);
          const tx = {
            select: () => txSelect.proxy,
            update: () => updateChain,
            insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
          };
          await cb(tx);
        }),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const jobs = await store.claimDueAgentJobs(now);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].agentId).toBe("agent-1");
      expect(jobs[0].wakeReason).toBe("scheduled_tick");
    });

    it("handles race: update.returning returns [] for already-claimed agent → skips that agent", async () => {
      const now = new Date();
      let selectCallCount = 0;
      const agentRow = { id: "agent-1" };

      const selectResults = [[], [], [agentRow]];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn(function () {
          const idx = selectCallCount++;
          const result = selectResults[idx] ?? [];
          return {
            limit: vi.fn(() => Promise.resolve(selectResults[selectCallCount - 1] ?? result)),
            then: (resolve: any) => resolve(result),
          };
        }),
      };
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);

      // update.returning returns [] — the agent was already claimed
      const updateReturning = vi.fn().mockResolvedValue([]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };

      const customDb: any = {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => updateChain),
        transaction: vi.fn(async (cb: any) => {
          const tx = {
            select: () => createChainableMock([{ value: 0 }]).proxy,
            update: () => updateChain,
            insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
          };
          await cb(tx);
        }),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const jobs = await store.claimDueAgentJobs(now);

      expect(jobs).toEqual([]);
    });
  });

  // ── claimImmediateJob ──────────────────────────────────────────────

  describe("claimImmediateJob", () => {
    it("returns true when update succeeds (returning has rows)", async () => {
      const updateReturning = vi.fn().mockResolvedValue([{ id: "agent-1" }]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };
      const customDb: any = {
        update: vi.fn(() => updateChain),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.claimImmediateJob(makeJob());

      expect(result).toBe(true);
      expect(customDb.update).toHaveBeenCalled();
    });

    it("returns false when update returns empty (already running)", async () => {
      const updateReturning = vi.fn().mockResolvedValue([]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };
      const customDb: any = {
        update: vi.fn(() => updateChain),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.claimImmediateJob(makeJob());

      expect(result).toBe(false);
    });
  });

  // ── markRunning ────────────────────────────────────────────────────

  describe("markRunning", () => {
    it("returns true when transition from 'queued' succeeds", async () => {
      const updateReturning = vi.fn().mockResolvedValue([{ id: "agent-1" }]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };
      const customDb: any = { update: vi.fn(() => updateChain) };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.markRunning(makeJob());

      expect(result).toBe(true);
    });

    it("returns false when agent not in 'queued' state (returning is empty)", async () => {
      const updateReturning = vi.fn().mockResolvedValue([]);
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateReturning,
      };
      const customDb: any = { update: vi.fn(() => updateChain) };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.markRunning(makeJob());

      expect(result).toBe(false);
    });
  });

  // ── loadAgentExecutionConfig ───────────────────────────────────────

  describe("loadAgentExecutionConfig", () => {
    it("returns null when agent not found", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      const customDb: any = { select: vi.fn(() => selectChain) };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.loadAgentExecutionConfig("nonexistent");

      expect(result).toBeNull();
    });

    it("returns config with defaults (tickIntervalMs: 15000) when runtimeConfigJson empty", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            modelProvider: "anthropic",
            modelId: "claude-3",
            runtimeConfigJson: {},
          },
        ]),
      };
      const customDb: any = { select: vi.fn(() => selectChain) };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.loadAgentExecutionConfig("agent-1");

      expect(result).not.toBeNull();
      expect(result!.modelProvider).toBe("anthropic");
      expect(result!.modelId).toBe("claude-3");
      expect(result!.tickIntervalMs).toBe(15_000);
      expect(result!.turnTimeoutMs).toBe(45_000); // DEFAULT_TURN_TIMEOUT_MS
    });

    it("uses runtimeConfigJson.tickIntervalMs when present", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            modelProvider: "openai",
            modelId: "gpt-4",
            runtimeConfigJson: { tickIntervalMs: 30_000, turnTimeoutMs: 60_000 },
          },
        ]),
      };
      const customDb: any = { select: vi.fn(() => selectChain) };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const result = await store.loadAgentExecutionConfig("agent-1");

      expect(result!.tickIntervalMs).toBe(30_000);
      expect(result!.turnTimeoutMs).toBe(60_000);
    });
  });

  // ── persistRun ─────────────────────────────────────────────────────

  describe("persistRun", () => {
    function makeTxSpies() {
      const insertCalls: unknown[][] = [];
      const updateSetCalls: unknown[] = [];
      const selectResult = [{ value: 0 }];

      const txSelectChain = createChainableMock(selectResult);
      const tx = {
        insert: vi.fn((...args: unknown[]) => {
          insertCalls.push(args);
          return { values: vi.fn().mockResolvedValue(undefined) };
        }),
        update: vi.fn((...args: unknown[]) => {
          return {
            set: vi.fn((...setArgs: unknown[]) => {
              updateSetCalls.push(setArgs[0]);
              return {
                where: vi.fn().mockResolvedValue(undefined),
              };
            }),
          };
        }),
        select: vi.fn(() => txSelectChain.proxy),
      };

      return { tx, insertCalls, updateSetCalls };
    }

    it("inserts run with status 'completed' on success", async () => {
      const { tx } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const job = makeJob();
      const result = makeTurnResult({ success: true });

      await store.persistRun(job, result, { dataDir: "/tmp/test", events: [] });

      expect(customDb.transaction).toHaveBeenCalled();
      // First insert call is the run record
      expect(tx.insert).toHaveBeenCalled();
    });

    it("inserts run with status 'failed' on failure", async () => {
      const { tx } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const job = makeJob();
      const result = makeTurnResult({ success: false, errorMessage: "boom" });

      await store.persistRun(job, result, {
        dataDir: "/tmp/test",
        events: [],
        errorCode: "TURN_FAILED",
        errorMessage: "boom",
      });

      expect(customDb.transaction).toHaveBeenCalled();
    });

    it("updates agent to idle with nextWakeAt on success", async () => {
      const { tx, updateSetCalls } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      const nextWake = new Date(Date.now() + 15_000);
      const job = makeJob();
      const result = makeTurnResult({ success: true });

      await store.persistRun(job, result, { dataDir: "/tmp/test", events: [], nextWakeAt: nextWake });

      // The update call sets executionState
      expect(updateSetCalls.length).toBeGreaterThan(0);
      const agentUpdate = updateSetCalls.find(
        (call: any) => call.executionState === "idle" || call.executionState === "error",
      ) as any;
      expect(agentUpdate).toBeDefined();
      expect(agentUpdate.executionState).toBe("idle");
      expect(agentUpdate.nextWakeAt).toEqual(nextWake);
    });
  });

  // ── persistRunFailure ──────────────────────────────────────────────

  describe("persistRunFailure", () => {
    function makeTxSpies() {
      const insertCalls: unknown[][] = [];
      const updateSetCalls: unknown[] = [];

      const txSelectChain = createChainableMock([{ value: 0 }]);
      const tx = {
        insert: vi.fn((...args: unknown[]) => {
          insertCalls.push(args);
          return { values: vi.fn().mockResolvedValue(undefined) };
        }),
        update: vi.fn(() => ({
          set: vi.fn((...setArgs: unknown[]) => {
            updateSetCalls.push(setArgs[0]);
            return {
              where: vi.fn().mockResolvedValue(undefined),
            };
          }),
        })),
        select: vi.fn(() => txSelectChain.proxy),
      };

      return { tx, insertCalls, updateSetCalls };
    }

    it("inserts failed run record", async () => {
      const { tx } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      await store.persistRunFailure({
        job: makeJob(),
        errorCode: "TIMEOUT",
        errorMessage: "Turn timed out",
      });

      expect(tx.insert).toHaveBeenCalled();
    });

    it("updates agent to 'error' by default", async () => {
      const { tx, updateSetCalls } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      await store.persistRunFailure({
        job: makeJob(),
        errorCode: "TIMEOUT",
        errorMessage: "Turn timed out",
      });

      const agentUpdate = updateSetCalls.find((call: any) => call.executionState != null) as any;
      expect(agentUpdate).toBeDefined();
      expect(agentUpdate.executionState).toBe("error");
    });

    it('uses custom executionState (e.g. "waiting_auth") when provided', async () => {
      const { tx, updateSetCalls } = makeTxSpies();
      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      await store.persistRunFailure({
        job: makeJob(),
        errorCode: "SESSION_EXPIRED",
        errorMessage: "Session expired",
        executionState: "waiting_auth",
      });

      const agentUpdate = updateSetCalls.find((call: any) => call.executionState != null) as any;
      expect(agentUpdate.executionState).toBe("waiting_auth");
    });
  });

  // ── markSessionExpired ─────────────────────────────────────────────

  describe("markSessionExpired", () => {
    it('sets session status "expired" and agent to "waiting_auth"', async () => {
      const updateSetCalls: unknown[] = [];
      const txSelectChain = createChainableMock([{ value: 0 }]);
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn((...setArgs: unknown[]) => {
            updateSetCalls.push(setArgs[0]);
            return {
              where: vi.fn().mockResolvedValue(undefined),
            };
          }),
        })),
        select: vi.fn(() => txSelectChain.proxy),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      };

      const customDb: any = {
        transaction: vi.fn(async (cb: any) => cb(tx)),
      };

      store = new ExecutorRunStore(customDb, mockArtifactStore as any);
      await store.markSessionExpired("agent-1", "Token expired");

      // First update: agentSessions → status "expired"
      expect(updateSetCalls[0]).toMatchObject({ status: "expired", errorMessage: "Token expired" });

      // Second update: agents → executionState "waiting_auth"
      expect(updateSetCalls[1]).toMatchObject({
        setupStatus: "pending_auth",
        executionState: "waiting_auth",
        setupErrorMessage: "Token expired",
      });

      // Should also append two events (session_invalidated + setup_changed)
      expect(tx.insert).toHaveBeenCalled();
    });
  });
});
