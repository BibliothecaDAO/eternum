import { describe, expect, it, vi } from "vitest";
import type { GameSyncProvisionalWrite, GameSyncStore } from "./game-sync-types";
import { ProvisionalWriteManager, trackProvisionalTransaction } from "./provisional-write-manager";

const WRITE: GameSyncProvisionalWrite = {
  entityId: "0x1",
  model: "Building",
  patch: { category: 7, population: { current: 4 } },
  matchPatch: { category: 7, population: { current: 4 } },
};

const createStore = () =>
  ({
    applyEntityOperations: vi.fn(),
    applyEvent: vi.fn(),
    listModelEntityIds: vi.fn(() => []),
    applyProvisionalWrites: vi.fn(),
    removeProvisionalWrites: vi.fn(),
  }) satisfies GameSyncStore;

describe("ProvisionalWriteManager", () => {
  it("keeps confirmed overlays until every patch field is stable in authoritative ingest", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([WRITE]);

    intent.bindTransaction("0xtx");
    expect(intent.isInputLocked()).toBe(true);
    expect(manager.hasInputLock("s1_eternum-Building", "0x1")).toBe(true);
    intent.confirm();
    expect(intent.isInputLocked()).toBe(false);
    expect(manager.hasInputLock("Building", "0x1")).toBe(false);

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "s1_eternum-Building", value: { category: 7 } },
    ]);
    vi.advanceTimersByTime(3_000);
    expect(store.removeProvisionalWrites).not.toHaveBeenCalled();

    manager.observeAuthoritativeObservations([
      {
        type: "model",
        entityId: "0x1",
        model: "s1_eternum-Building",
        value: { category: 7, population: { current: 4 } },
      },
    ]);
    vi.advanceTimersByTime(2_499);
    expect(store.removeProvisionalWrites).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(store.removeProvisionalWrites).toHaveBeenCalledWith(intent.id);
    expect(intent.status).toBe("settled");
    vi.useRealTimers();
  });

  it("restarts the source-match hold when a stale echo follows a match", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([WRITE]);
    intent.confirm();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
    ]);
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: { category: 6 } },
    ]);
    vi.advanceTimersByTime(3_000);
    expect(store.removeProvisionalWrites).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("settles a declared no-op source outcome only after the stale-echo hold", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "ExplorerTroops",
        patch: { coord: { x: 12, y: 9 }, troops: { stamina: { amount: 30n } } },
        matchPatch: { coord: { x: 12, y: 9 } },
        sourcePatch: { coord: { x: 11, y: 9 } },
      },
    ]);
    intent.confirm();
    manager.observeAuthoritativeObservations([
      {
        type: "model",
        entityId: "0x2",
        model: "ExplorerTroops",
        value: { coord: { x: 11, y: 9 } },
      },
    ]);

    vi.advanceTimersByTime(2_499);
    expect(intent.status).toBe("confirmed");
    vi.advanceTimersByTime(1);
    expect(intent.status).toBe("settled");
    vi.useRealTimers();
  });

  it("settles on deterministic match fields while drifting overlay fields differ", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "ExplorerTroops",
        patch: { coord: { x: 12, y: 9 }, troops: { stamina: { amount: 30n, updated_tick: 5n } } },
        matchPatch: { coord: { x: 12, y: 9 } },
      },
    ]);
    intent.confirm();

    manager.observeAuthoritativeObservations([
      {
        type: "model",
        entityId: "0x2",
        model: "ExplorerTroops",
        value: { coord: { x: 12, y: 9 }, troops: { stamina: { amount: 34n, updated_tick: 6n } } },
      },
    ]);
    vi.advanceTimersByTime(2_500);

    expect(intent.status).toBe("settled");
    vi.useRealTimers();
  });

  it("reports a confirmed intent that has not matched after 30 seconds", () => {
    vi.useFakeTimers();
    const onIntentStalled = vi.fn();
    const manager = new ProvisionalWriteManager(createStore(), { onIntentStalled });
    const intent = manager.createIntent([WRITE]);
    intent.bindTransaction("0xtx");
    intent.confirm();

    vi.advanceTimersByTime(29_999);
    expect(onIntentStalled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onIntentStalled).toHaveBeenCalledWith({
      intentId: intent.id,
      transactionHash: "0xtx",
      unmatchedWrites: [
        {
          entityId: WRITE.entityId,
          model: WRITE.model,
          matchPatch: WRITE.matchPatch,
          sourcePatch: undefined,
        },
      ],
    });
    vi.useRealTimers();
  });

  it("removes the overlay immediately when submission or receipt fails", async () => {
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const submissionFailure = manager.createIntent([WRITE]);
    submissionFailure.fail();
    expect(store.removeProvisionalWrites).toHaveBeenCalledWith(submissionFailure.id);

    const receiptFailure = manager.createIntent([WRITE]);
    trackProvisionalTransaction(
      receiptFailure,
      { waitForTransactionWithCheck: vi.fn().mockRejectedValue(new Error("reverted")) },
      { transaction_hash: "0xtx" },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(receiptFailure.status).toBe("failed");
  });
});
