import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseQueue, QueueableTransaction } from "./promise-queue";
import { TransactionExecutor } from "./transaction-executor";
import { TransactionType } from "./types";
import { TransactionCostCategory } from "./batch-config";

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
    expect(executor.executeAndCheckTransaction).toHaveBeenCalledWith(
      signer,
      calls,
      undefined,
      { waitForConfirmation: false, transactionType: TransactionType.SET_ENTITY_NAME },
    );
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
      expect.arrayContaining([
        expect.objectContaining({ type: TransactionType.SET_ENTITY_NAME, count: 3 }),
      ]),
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

    const p1 = queue.enqueue({ signer, calls: makeCall("a"), transactionType: TransactionType.SET_ENTITY_NAME }).catch((e: unknown) => e);
    const p2 = queue.enqueue({ signer, calls: makeCall("b"), transactionType: TransactionType.SET_ENTITY_NAME }).catch((e: unknown) => e);
    const p3 = queue.enqueue({ signer, calls: makeCall("c"), transactionType: TransactionType.SET_ENTITY_NAME }).catch((e: unknown) => e);

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
