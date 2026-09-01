import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseQueue, QueueableTransaction } from "./promise-queue";
import { TransactionExecutor } from "./transaction-executor";
import { TransactionType } from "./types";
import { TransactionCostCategory, BatchDelayConfig } from "./batch-config";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeSigner = (address = "0x123") =>
  ({
    address,
    estimateInvokeFee: vi.fn(),
  }) as any;

const makeCall = (entrypoint = "test_action") => ({
  contractAddress: "0xcontract",
  entrypoint,
  calldata: [],
});

const makeExecutor = (): TransactionExecutor => ({
  executeAndCheckTransaction: vi.fn().mockResolvedValue({
    statusReceipt: "PENDING",
    transaction_hash: "0xabc",
  }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromiseQueue", () => {
  let executor: ReturnType<typeof makeExecutor>;

  beforeEach(() => {
    executor = makeExecutor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1 -----------------------------------------------------------------------
  it("single item enqueue calls executor with correct signer and calls", async () => {
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();
    const calls = makeCall("do_something");

    await queue.enqueue({
      signer,
      calls,
      transactionType: TransactionType.SET_ENTITY_NAME,
    });

    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledWith(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.SET_ENTITY_NAME,
    });
  });

  // 2 -----------------------------------------------------------------------
  it("multiple items within batch delay are grouped by category", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 100 });
    const signer = makeSigner();

    const call1 = makeCall("name_1");
    const call2 = makeCall("name_2");
    const call3 = makeCall("name_3");

    // All LOW category (SET_ENTITY_NAME)
    const p1 = queue.enqueue({ signer, calls: call1, transactionType: TransactionType.SET_ENTITY_NAME });
    const p2 = queue.enqueue({ signer, calls: call2, transactionType: TransactionType.SET_ENTITY_NAME });
    const p3 = queue.enqueue({ signer, calls: call3, transactionType: TransactionType.SET_ENTITY_NAME });

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2, p3]);

    // All 3 should be batched into a single executor call
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);

    // Calls should be flattened into an array
    const submittedCalls = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(submittedCalls).toEqual([call1, call2, call3]);

    // batchDetails should be provided
    const batchDetails = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(batchDetails).toBeDefined();
    expect(batchDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: TransactionType.SET_ENTITY_NAME, count: 3 })]),
    );
  });

  // 3 -----------------------------------------------------------------------
  it("batch splitting respects CATEGORY_BATCH_LIMITS", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    // LOW category limit is 10 — enqueue 12 items
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 12; i++) {
      promises.push(
        queue.enqueue({
          signer,
          calls: makeCall(`action_${i}`),
          transactionType: TransactionType.SET_ENTITY_NAME,
        }),
      );
    }

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // Should split into 2 batches: 10 + 2
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);

    const firstBatchCalls = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const secondBatchCalls = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[1][1];

    expect(firstBatchCalls).toHaveLength(10);
    expect(secondBatchCalls).toHaveLength(2);
  });

  // 4 -----------------------------------------------------------------------
  it("rejection propagates to all items in a failed batch", async () => {
    const error = new Error("execution failed");
    (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const p1 = queue
      .enqueue({ signer, calls: makeCall("a"), transactionType: TransactionType.SET_ENTITY_NAME })
      .catch((e: unknown) => e);
    const p2 = queue
      .enqueue({ signer, calls: makeCall("b"), transactionType: TransactionType.SET_ENTITY_NAME })
      .catch((e: unknown) => e);
    const p3 = queue
      .enqueue({ signer, calls: makeCall("c"), transactionType: TransactionType.SET_ENTITY_NAME })
      .catch((e: unknown) => e);

    await vi.runAllTimersAsync();

    const results = await Promise.all([p1, p2, p3]);
    expect(results[0]).toBe(error);
    expect(results[1]).toBe(error);
    expect(results[2]).toBe(error);
  });

  // 5 -----------------------------------------------------------------------
  it("items with different signers produce separate batches", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });

    const signerA = makeSigner("0x111");
    const signerB = makeSigner("0x222");

    const promises = [
      queue.enqueue({ signer: signerA, calls: makeCall("a1"), transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer: signerA, calls: makeCall("a2"), transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer: signerB, calls: makeCall("b1"), transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer: signerB, calls: makeCall("b2"), transactionType: TransactionType.SET_ENTITY_NAME }),
    ];

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // 2 batches: one per signer
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);

    const firstSigner = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const secondSigner = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[1][0];

    // Different signers for each batch
    expect(firstSigner.address).not.toBe(secondSigner.address);
    expect([firstSigner.address, secondSigner.address].sort()).toEqual(["0x111", "0x222"]);
  });

  // 6 -----------------------------------------------------------------------
  it("multi-item batch flattens calls from all items correctly", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const callA = makeCall("action_a");
    const callB = makeCall("action_b");
    const callC = makeCall("action_c");

    const promises = [
      queue.enqueue({ signer, calls: callA, transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer, calls: callB, transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer, calls: callC, transactionType: TransactionType.SET_ENTITY_NAME }),
    ];

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    const flattenedCalls = (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(flattenedCalls).toEqual([callA, callB, callC]);
  });

  // 7 -----------------------------------------------------------------------
  it("items from different categories produce separate batches", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    // HIGH category
    const highCall = makeCall("explore");
    // LOW category
    const lowCall = makeCall("set_name");

    const promises = [
      queue.enqueue({ signer, calls: highCall, transactionType: TransactionType.EXPLORE }),
      queue.enqueue({ signer, calls: lowCall, transactionType: TransactionType.SET_ENTITY_NAME }),
    ];

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // One batch per category
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
  });

  // 8 -----------------------------------------------------------------------
  it("enqueue returns the result from executor", async () => {
    const expectedResult = {
      statusReceipt: "CONFIRMED",
      transaction_hash: "0xdeadbeef",
    };
    (executor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const result = await queue.enqueue({
      signer,
      calls: makeCall("action"),
      transactionType: TransactionType.SET_ENTITY_NAME,
    });

    expect(result).toEqual(expectedResult);
  });
});

// ===========================================================================
// Phase 2: Configurable Batch Delay
// ===========================================================================

describe("Configurable Batch Delay", () => {
  let executor: ReturnType<typeof makeExecutor>;

  beforeEach(() => {
    executor = makeExecutor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes immediately when delay is 0 for a HIGH category item", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const p = queue.enqueue({
      signer,
      calls: makeCall("battle"),
      transactionType: TransactionType.BATTLE_START,
    });

    await vi.advanceTimersByTimeAsync(0);
    await p;

    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
  });

  it("waits configured delay before processing MEDIUM items", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, { batchDelayMs: 500 });
    const signer = makeSigner();

    const p = queue.enqueue({
      signer,
      calls: makeCall("travel"),
      transactionType: TransactionType.TRAVEL_HEX,
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(executor.executeAndCheckTransaction).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
  });

  it("falls back to default 1000ms when no delay config provided", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor);
    const signer = makeSigner();

    const p = queue.enqueue({
      signer,
      calls: makeCall("name"),
      transactionType: TransactionType.SET_ENTITY_NAME,
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(executor.executeAndCheckTransaction).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
  });

  it("uses per-category delay config when provided", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, {
      batchDelayConfig: {
        categoryDelays: {
          HIGH: 0,
          MEDIUM: 500,
          LOW: 1000,
        } as Partial<Record<TransactionCostCategory, number>>,
      },
    });
    const signer = makeSigner();

    // HIGH item should process at delay 0
    const pHigh = queue.enqueue({
      signer,
      calls: makeCall("battle"),
      transactionType: TransactionType.BATTLE_START,
    });

    await vi.advanceTimersByTimeAsync(0);
    await pHigh;
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);

    // MEDIUM item should process at delay 500
    const pMedium = queue.enqueue({
      signer,
      calls: makeCall("travel"),
      transactionType: TransactionType.TRAVEL_HEX,
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await pMedium;
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
  });

  it("reschedules with shorter delay when a faster-category item arrives", async () => {
    vi.useFakeTimers();
    const queue = new PromiseQueue(executor, {
      batchDelayConfig: {
        categoryDelays: {
          HIGH: 0,
          LOW: 1000,
        } as Partial<Record<TransactionCostCategory, number>>,
      },
    });
    const signer = makeSigner();

    // Enqueue a LOW item — timer starts for 1000ms
    const pLow = queue.enqueue({
      signer,
      calls: makeCall("name"),
      transactionType: TransactionType.SET_ENTITY_NAME,
    });

    // Advance 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(executor.executeAndCheckTransaction).not.toHaveBeenCalled();

    // Enqueue a HIGH item — delay=0, should reschedule to immediate
    const pHigh = queue.enqueue({
      signer,
      calls: makeCall("battle"),
      transactionType: TransactionType.BATTLE_START,
    });

    // The timer should fire at 0ms from now (immediate reschedule)
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([pLow, pHigh]);

    // Both items processed together (or in separate category batches)
    expect(executor.executeAndCheckTransaction).toHaveBeenCalled();
  });
});

// ===========================================================================
// Phase 3: Parallel Category Processing
// ===========================================================================

describe("Parallel Category Processing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes independent categories in parallel", async () => {
    // Create a mock executor with artificial 50ms delay
    const executor: TransactionExecutor = {
      executeAndCheckTransaction: vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ statusReceipt: "PENDING", transaction_hash: "0xabc" }), 50),
            ),
        ),
    };

    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const start = Date.now();

    // Enqueue 2 HIGH items and 2 LOW items
    const promises = [
      queue.enqueue({ signer, calls: makeCall("battle1"), transactionType: TransactionType.BATTLE_START }),
      queue.enqueue({ signer, calls: makeCall("battle2"), transactionType: TransactionType.BATTLE_RESOLVE }),
      queue.enqueue({ signer, calls: makeCall("name1"), transactionType: TransactionType.SET_ENTITY_NAME }),
      queue.enqueue({ signer, calls: makeCall("name2"), transactionType: TransactionType.SET_ADDRESS_NAME }),
    ];

    await Promise.all(promises);
    const elapsed = Date.now() - start;

    // Should be ~50ms (parallel), not ~100ms (sequential)
    // Use generous margin but it should definitely be less than 100ms
    expect(elapsed).toBeLessThan(90);

    // 2 batches: one HIGH, one LOW
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
  });

  it("dispatches batches within a category in enqueue order", async () => {
    const callOrder: number[] = [];
    let callIndex = 0;

    const executor: TransactionExecutor = {
      executeAndCheckTransaction: vi.fn().mockImplementation(() => {
        const idx = callIndex++;
        callOrder.push(idx);
        return Promise.resolve({ statusReceipt: "PENDING", transaction_hash: `0x${idx}` });
      }),
    };

    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    // Enqueue 15 LOW items (batch limit 10, so 2 chunks)
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 15; i++) {
      promises.push(
        queue.enqueue({
          signer,
          calls: makeCall(`action_${i}`),
          transactionType: TransactionType.SET_ENTITY_NAME,
        }),
      );
    }

    await Promise.all(promises);

    // Should be 2 batches: 10 + 5
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);

    // First batch (index 0) is dispatched before second batch (index 1)
    expect(callOrder).toEqual([0, 1]);
  });

  it("pipelines separate batches without waiting on the previous send", async () => {
    vi.useFakeTimers();
    let settled = 0;
    const executor: TransactionExecutor = {
      executeAndCheckTransaction: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              settled += 1;
              resolve({ statusReceipt: "PENDING", transaction_hash: `0x${settled}` });
            }, 150),
          ),
      ),
    };
    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pA = queue.enqueue({ signer, calls: makeCall("explorer_move"), transactionType: TransactionType.EXPLORE });
    await vi.advanceTimersByTimeAsync(0);
    const pB = queue.enqueue({ signer, calls: makeCall("explorer_move"), transactionType: TransactionType.EXPLORE });
    await vi.advanceTimersByTimeAsync(0);

    expect(executor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
    expect(settled).toBe(0);

    await vi.advanceTimersByTimeAsync(150);
    await expect(Promise.all([pA, pB])).resolves.toHaveLength(2);
    expect(settled).toBe(2);
  });

  it("still merges same-signer, same-category items from one tick into one multicall", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();
    const callA = makeCall("attack_a");
    const callB = makeCall("attack_b");

    await Promise.all([
      queue.enqueue({ signer, calls: callA, transactionType: TransactionType.ATTACK_EXPLORER_VS_EXPLORER }),
      queue.enqueue({ signer, calls: callB, transactionType: TransactionType.ATTACK_EXPLORER_VS_EXPLORER }),
    ]);

    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
    const call = (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toEqual([callA, callB]);
    expect(call[2]).toEqual([{ type: TransactionType.ATTACK_EXPLORER_VS_EXPLORER, count: 2 }]);
  });

  it("error in one category does not block others", async () => {
    const executor: TransactionExecutor = {
      executeAndCheckTransaction: vi.fn().mockImplementation((signer, calls, batchDetails, options) => {
        // Fail for HIGH items (BATTLE_START), succeed for LOW items
        const txType = options?.transactionType;
        if (txType === TransactionType.BATTLE_START) {
          return Promise.reject(new Error("HIGH category failed"));
        }
        return Promise.resolve({ statusReceipt: "PENDING", transaction_hash: "0xok" });
      }),
    };

    const queue = new PromiseQueue(executor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pHigh = queue
      .enqueue({ signer, calls: makeCall("battle"), transactionType: TransactionType.BATTLE_START })
      .catch((e: unknown) => e);

    const pLow = queue.enqueue({
      signer,
      calls: makeCall("name"),
      transactionType: TransactionType.SET_ENTITY_NAME,
    });

    const [highResult, lowResult] = await Promise.all([pHigh, pLow]);

    // HIGH should have rejected
    expect(highResult).toBeInstanceOf(Error);
    expect((highResult as Error).message).toBe("HIGH category failed");

    // LOW should have resolved successfully
    expect(lowResult).toEqual({ statusReceipt: "PENDING", transaction_hash: "0xok" });
  });

  // EXPLORE anti-batching ---------------------------------------------------
  it("never merges multiple EXPLORE txs into one multicall even when they land in the same batch window", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pA = queue.enqueue({
      signer,
      calls: [makeCall("request_random"), makeCall("explorer_move"), makeCall("explorer_extract_reward")],
      transactionType: TransactionType.EXPLORE,
    });
    const pB = queue.enqueue({
      signer,
      calls: [makeCall("request_random"), makeCall("explorer_move"), makeCall("explorer_extract_reward")],
      transactionType: TransactionType.EXPLORE,
    });

    await Promise.all([pA, pB]);

    // Two independent executor calls — never flattened into a single multicall.
    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);

    for (const call of (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls) {
      // Third arg is batchDetails — for a solo-submitted explore it must be
      // absent (undefined), which is the "single item" branch of processBatch.
      expect(call[2]).toBeUndefined();
    }
  });

  it("never merges queued VRF request_random transactions into one multicall", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pA = queue.enqueue({
      signer,
      calls: [makeCall("request_random"), makeCall("open_chest")],
      transactionType: TransactionType.OPEN_CHEST,
    });
    const pB = queue.enqueue({
      signer,
      calls: [makeCall("request_random"), makeCall("open_chest")],
      transactionType: TransactionType.OPEN_CHEST,
    });

    await Promise.all([pA, pB]);

    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
    for (const call of (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[2]).toBeUndefined();
    }
  });

  it("batches CREATE_BUILDING transactions into one multicall", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();
    const callA = makeCall("create_building_a");
    const callB = makeCall("create_building_b");

    const pA = queue.enqueue({
      signer,
      calls: callA,
      transactionType: TransactionType.CREATE_BUILDING,
    });
    const pB = queue.enqueue({
      signer,
      calls: callB,
      transactionType: TransactionType.CREATE_BUILDING,
    });

    await Promise.all([pA, pB]);

    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
    const call = (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toEqual([callA, callB]);
    expect(call[2]).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: TransactionType.CREATE_BUILDING, count: 2 })]),
    );
    expect(call[3]).toEqual({ waitForConfirmation: false });
  });

  it("never merges DESTROY_BUILDING transactions into one multicall", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pA = queue.enqueue({
      signer,
      calls: makeCall("destroy_building"),
      transactionType: TransactionType.DESTROY_BUILDING,
    });
    const pB = queue.enqueue({
      signer,
      calls: makeCall("destroy_building"),
      transactionType: TransactionType.DESTROY_BUILDING,
    });

    await Promise.all([pA, pB]);

    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(2);
    for (const call of (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[1]).toEqual(makeCall("destroy_building"));
      expect(call[2]).toBeUndefined();
      expect(call[3]).toEqual({
        waitForConfirmation: false,
        transactionType: TransactionType.DESTROY_BUILDING,
      });
    }
  });

  it("keeps non-VRF HIGH transactions batched around isolated VRF submissions", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const battleA = makeCall("battle_a");
    const battleB = makeCall("battle_b");
    const battleC = makeCall("battle_c");
    const battleD = makeCall("battle_d");
    const vrfCalls = [makeCall("request_random"), makeCall("open_chest")];

    await Promise.all([
      queue.enqueue({
        signer,
        calls: battleA,
        transactionType: TransactionType.BATTLE_START,
      }),
      queue.enqueue({
        signer,
        calls: battleB,
        transactionType: TransactionType.BATTLE_START,
      }),
      queue.enqueue({
        signer,
        calls: vrfCalls,
        transactionType: TransactionType.OPEN_CHEST,
      }),
      queue.enqueue({
        signer,
        calls: battleC,
        transactionType: TransactionType.BATTLE_START,
      }),
      queue.enqueue({
        signer,
        calls: battleD,
        transactionType: TransactionType.BATTLE_START,
      }),
    ]);

    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(3);

    const executorCalls = (localExecutor.executeAndCheckTransaction as ReturnType<typeof vi.fn>).mock.calls;
    expect(executorCalls[0][1]).toEqual([battleA, battleB]);
    expect(executorCalls[0][2]).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: TransactionType.BATTLE_START, count: 2 })]),
    );

    expect(executorCalls[1][1]).toEqual(vrfCalls);
    expect(executorCalls[1][2]).toBeUndefined();
    expect(executorCalls[1][3]).toEqual({
      waitForConfirmation: false,
      transactionType: TransactionType.OPEN_CHEST,
    });

    expect(executorCalls[2][1]).toEqual([battleC, battleD]);
    expect(executorCalls[2][2]).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: TransactionType.BATTLE_START, count: 2 })]),
    );
  });

  it("still batches non-EXPLORE HIGH txs together", async () => {
    const localExecutor = makeExecutor();
    const queue = new PromiseQueue(localExecutor, { batchDelayMs: 0 });
    const signer = makeSigner();

    const pA = queue.enqueue({
      signer,
      calls: makeCall("attack_a"),
      transactionType: TransactionType.ATTACK_EXPLORER_VS_EXPLORER,
    });
    const pB = queue.enqueue({
      signer,
      calls: makeCall("attack_b"),
      transactionType: TransactionType.ATTACK_EXPLORER_VS_EXPLORER,
    });

    await Promise.all([pA, pB]);

    // Other HIGH types still batch into one multicall (preserves existing behavior).
    expect(localExecutor.executeAndCheckTransaction).toHaveBeenCalledTimes(1);
  });
});
