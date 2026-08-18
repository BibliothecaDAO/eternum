import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameSyncProvisionalWrite, GameSyncStore } from "./game-sync-types";
import { ProvisionalWriteManager, trackProvisionalTransaction } from "./provisional-write-manager";

const WRITE: GameSyncProvisionalWrite = {
  entityId: "0x1",
  model: "Building",
  patch: { category: 7, population: { current: 4 } },
  matchPatch: { category: 7, population: { current: 4 } },
};

const createStore = (authoritativeValue: Record<string, unknown> | null = null) =>
  ({
    applyEntityOperations: vi.fn(),
    applyEvent: vi.fn(),
    listModelEntityIds: vi.fn(() => []),
    readAuthoritativeModel: vi.fn(() => authoritativeValue),
    applyProvisionalWrites: vi.fn(),
    removeProvisionalWrites: vi.fn(),
  }) satisfies GameSyncStore;

const createdIntentId = (store: ReturnType<typeof createStore>): string =>
  String(store.applyProvisionalWrites.mock.calls.at(-1)?.[0]);

afterEach(() => vi.useRealTimers());

describe("ProvisionalWriteManager", () => {
  it("holds an exact-match overlay until every evidence field is authoritative", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([WRITE]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);

    expect(manager.hasInputLock("Building", "0x1")).toBe(true);
    intent.bindTransaction("0xtx");
    expect(manager.hasInputLock("Building", "0x1")).toBe(false);
    intent.confirm();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: { category: 7 } },
    ]);
    vi.advanceTimersByTime(3_000);
    expect(store.removeProvisionalWrites).not.toHaveBeenCalled();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
    ]);
    vi.advanceTimersByTime(2_500);

    expect(store.removeProvisionalWrites).toHaveBeenCalledWith(createdIntentId(store));
    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("matches a baseline-delta echo that raced the transaction hash once it binds", () => {
    vi.useFakeTimers();
    const store = createStore({ WOOD_BALANCE: 100n });
    const phases: string[] = [];
    const manager = new ProvisionalWriteManager(store, {
      onIntentPhase: ({ phase }) => phases.push(phase),
    });
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "Resource",
        patch: { WOOD_BALANCE: 90n },
        baselineDeltaFields: ["WOOD_BALANCE"],
      },
    ]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);

    // Torii's preconfirmed echo can land before execute() returns the hash.
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x2", model: "Resource", value: { WOOD_BALANCE: 90n } },
    ]);
    expect(phases).toContain("baseline_delta_before_hash");

    intent.bindTransaction("0xtx");
    intent.confirm();
    vi.advanceTimersByTime(2_500);

    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("does not treat a bound hash alone as baseline-delta evidence", () => {
    vi.useFakeTimers();
    const store = createStore({ WOOD_BALANCE: 100n });
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "Resource",
        patch: { WOOD_BALANCE: 90n },
        baselineDeltaFields: ["WOOD_BALANCE"],
      },
    ]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);

    intent.bindTransaction("0xtx");
    intent.confirm();
    vi.advanceTimersByTime(2_500);
    expect(outcomes).not.toHaveBeenCalled();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x2", model: "Resource", value: { WOOD_BALANCE: 89n } },
    ]);
    vi.advanceTimersByTime(2_500);
    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("keeps settled-duration locks active until the authoritative echo", () => {
    vi.useFakeTimers();
    const manager = new ProvisionalWriteManager(createStore());
    const intent = manager.createIntent([WRITE], { lockUntil: "settled" });
    intent.bindTransaction("0xtx");
    intent.confirm();

    expect(manager.hasInputLock("Building", "0x1")).toBe(true);
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
    ]);
    vi.advanceTimersByTime(2_500);
    expect(manager.hasInputLock("Building", "0x1")).toBe(false);
  });

  it("reports created, transaction-hash, and first authoritative-echo phases once", () => {
    const phases: string[] = [];
    const manager = new ProvisionalWriteManager(createStore(), {
      onIntentPhase: ({ phase }) => phases.push(phase),
    });
    const intent = manager.createIntent([WRITE]);

    intent.bindTransaction("0xtx");
    intent.confirm();
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
    ]);

    expect(phases).toEqual(["created", "transaction_hash", "authoritative_echo"]);
    manager.dispose();
  });

  it("settles a declared no-op source outcome", () => {
    vi.useFakeTimers();
    const manager = new ProvisionalWriteManager(createStore());
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "ExplorerTroops",
        patch: { coord: { x: 12, y: 9 } },
        matchPatch: { coord: { x: 12, y: 9 } },
        sourcePatch: { coord: { x: 11, y: 9 } },
      },
    ]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);
    intent.confirm();
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x2", model: "ExplorerTroops", value: { coord: { x: 11, y: 9 } } },
    ]);

    vi.advanceTimersByTime(2_500);
    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("reports, fails, and removes a confirmed intent that stalls", () => {
    vi.useFakeTimers();
    const store = createStore();
    const onIntentStalled = vi.fn();
    const manager = new ProvisionalWriteManager(store, { onIntentStalled });
    const intent = manager.createIntent([WRITE]);
    const outcomes: string[] = [];
    intent.subscribe((outcome) => outcomes.push(outcome));
    intent.bindTransaction("0xtx");
    intent.confirm();

    vi.advanceTimersByTime(30_000);

    expect(onIntentStalled).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionHash: "0xtx",
        unmatchedWrites: [
          expect.objectContaining({
            entityId: WRITE.entityId,
            model: WRITE.model,
            matchPatch: WRITE.matchPatch,
          }),
        ],
      }),
    );
    expect(outcomes).toEqual(["stalled", "failed"]);
    expect(store.removeProvisionalWrites).toHaveBeenCalledWith(createdIntentId(store));
  });

  it("settles a null matchPatch when the authoritative row is deleted", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([
      { entityId: "0x1", model: "Building", patch: { category: 0 }, matchPatch: null },
    ]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);
    intent.bindTransaction("0xtx");
    intent.confirm();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: { category: 7 } },
    ]);
    vi.advanceTimersByTime(2_500);
    expect(outcomes).not.toHaveBeenCalled();

    manager.observeAuthoritativeObservations([{ type: "delete-entity", entityId: "0x1" }]);
    vi.advanceTimersByTime(2_500);

    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("keeps a matched write settled when a later action's echo diverges from it", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([WRITE]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);
    intent.bindTransaction("0xtx");
    intent.confirm();

    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: WRITE.patch },
    ]);
    // The next placement bumps the same row past this intent's prediction
    // before the reconciliation hold releases — the match must stay settled.
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x1", model: "Building", value: { category: 9 } },
    ]);
    vi.advanceTimersByTime(2_500);

    expect(outcomes).toHaveBeenCalledWith("settled");
  });

  it("reports provisional-only rows until the chain backs them", () => {
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    expect(manager.isProvisionalOnly("Building", "0x1")).toBe(false);

    const intent = manager.createIntent([WRITE]);
    expect(manager.isProvisionalOnly("Building", "0x1")).toBe(true);

    store.readAuthoritativeModel.mockReturnValue({ category: 7 });
    expect(manager.isProvisionalOnly("Building", "0x1")).toBe(false);

    store.readAuthoritativeModel.mockReturnValue(null);
    intent.fail();
    expect(manager.isProvisionalOnly("Building", "0x1")).toBe(false);
  });

  it("settles at the tripwire when the intent reconciled but its release was flapped away", () => {
    vi.useFakeTimers();
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([
      {
        entityId: "0x2",
        model: "ExplorerTroops",
        patch: { coord: { x: 12, y: 9 } },
        matchPatch: { coord: { x: 12, y: 9 } },
        sourcePatch: { coord: { x: 11, y: 9 } },
      },
    ]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);
    intent.bindTransaction("0xtx");
    intent.confirm();

    // Source-coord echo schedules a release, then an unrelated echo flaps
    // sourceMatched off and cancels it; the destination echo then matches but
    // the release-window race can leave nothing scheduled. The tripwire must
    // settle, not force-fail.
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x2", model: "ExplorerTroops", value: { coord: { x: 11, y: 9 } } },
    ]);
    manager.observeAuthoritativeObservations([
      { type: "model", entityId: "0x2", model: "ExplorerTroops", value: { coord: { x: 12, y: 9 } } },
    ]);
    vi.advanceTimersByTime(30_000);

    expect(outcomes).toHaveBeenCalledWith("settled");
    expect(outcomes).not.toHaveBeenCalledWith("stalled");
  });

  it("fails independently when a tracked receipt rejects", async () => {
    const store = createStore();
    const manager = new ProvisionalWriteManager(store);
    const intent = manager.createIntent([WRITE]);
    const outcomes = vi.fn();
    intent.subscribe(outcomes);

    trackProvisionalTransaction(
      intent,
      { waitForTransactionWithCheck: vi.fn().mockRejectedValue(new Error("reverted")) },
      { transaction_hash: "0xtx" },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(outcomes).toHaveBeenCalledWith("failed");
  });
});
