import type { Call, ResourceBoundsBN } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EternumProvider } from "./index";
import { PromiseQueue } from "./promise-queue";
import type { TransactionFailedPayload } from "./types";
import { TransactionType } from "./types";

const makeResourceBounds = (l2GasMaxAmount: bigint): ResourceBoundsBN => ({
  l1_gas: { max_amount: 1n, max_price_per_unit: 1n },
  l1_data_gas: { max_amount: 1n, max_price_per_unit: 1n },
  l2_gas: { max_amount: l2GasMaxAmount, max_price_per_unit: 1n },
});

const makeProvider = () => {
  const provider = Object.create(EternumProvider.prototype) as any;
  provider.emit = vi.fn();
  provider.execute = vi.fn().mockResolvedValue({ transaction_hash: "0xabc" });
  provider.startTransactionSpan = vi.fn(() => ({
    setAttribute: vi.fn(),
    addEvent: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  }));
  provider.failTransactionSpan = vi.fn();
  provider.completeTransactionSpan = vi.fn();
  provider.waitForTransactionWithCheckInternal = vi.fn().mockResolvedValue({ isReverted: () => false });
  provider.waitForTransactionWithTimeout = vi
    .fn()
    .mockResolvedValue({ status: "confirmed", receipt: { isReverted: () => false } });
  provider.pendingTransactionSpans = new Map();
  provider.pendingActorExecutionLocks = new Map();
  provider.cachedExploreExecutionDetails = new Map();
  provider.transactionStreamWaiter = vi.fn().mockResolvedValue({
    block: null,
    hash: "0xabc",
    status: "PRE_CONFIRMED",
  });
  provider.TRANSACTION_CONFIRM_TIMEOUT_MS = 10_000;
  provider.TRANSACTION_SUBMIT_TIMEOUT_MS = 20_000;
  provider.FEE_ESTIMATE_TIMEOUT_MS = 5_000;
  return provider;
};

const findTransactionFailedPayload = (
  provider: ReturnType<typeof makeProvider>,
): TransactionFailedPayload | undefined => {
  return provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed")?.[1];
};

describe("EternumProvider.executeAndCheckTransaction gas bounds", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sets a zero tip on fee estimation and submission", async () => {
    const provider = makeProvider();
    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(100n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await provider.executeAndCheckTransaction(signer, call);

    expect(signer.estimateInvokeFee).toHaveBeenCalledWith(call, { version: 3, tip: 0 });
    expect(provider.execute.mock.calls[0][2]).toMatchObject({
      version: 3,
      tip: 0,
      resourceBounds: makeResourceBounds(150n),
    });
  });

  it("uses configured fixed bounds without estimating", async () => {
    const provider = makeProvider();
    const resourceBounds = makeResourceBounds(1_200_000_000n);
    provider.executionResourceBounds = resourceBounds;
    const signer = { estimateInvokeFee: vi.fn() };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await provider.executeAndCheckTransaction(signer, call);

    expect(signer.estimateInvokeFee).not.toHaveBeenCalled();
    expect(provider.execute.mock.calls[0][2]).toEqual({ version: 3, tip: 0, resourceBounds });
  });

  it("reads the explorer id after scoped game calldata", () => {
    const provider = makeProvider();
    provider.gameId = 61;

    expect(
      provider.getExploreTransactionExplorerId({
        contractAddress: "0x1",
        entrypoint: "Explore",
        calldata: [61, 1, 259562, 4],
      }),
    ).toBe(`0x${BigInt(259562).toString(16)}`);
  });

  it("caps l2 gas max_amount at the current v3 mainnet limit", async () => {
    const provider = makeProvider();
    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await provider.executeAndCheckTransaction(signer, call);

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(1);
    const txDetails = provider.execute.mock.calls[0][2];
    expect(txDetails.version).toBe(3);
    expect(txDetails.resourceBounds.l2_gas.max_amount).toBe(1_200_000_000n);
  });

  it("submits without waiting when waitForConfirmation is false", async () => {
    const provider = makeProvider();
    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    const result = await provider.executeAndCheckTransaction(signer, call, undefined, {
      waitForConfirmation: false,
    });

    expect(provider.waitForTransactionWithTimeout).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0xabc",
    });
  });

  it("serializes all native actions per player until the stream barrier without blocking another player", async () => {
    const provider = makeProvider();
    let release!: (value: unknown) => void;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    provider.nativeSubmission = vi.fn().mockImplementation(async (signer: { address: string }, call: Call) => ({
      transaction_hash: signer.address === "0xabc" ? (call.entrypoint === "first" ? "0x1" : "0x2") : "0x3",
    }));
    provider.waitForTransactionWithCheckInternal = vi
      .fn()
      .mockImplementation((hash: string) => (hash === "0x1" ? barrier : Promise.resolve({ isReverted: () => false })));
    const firstSigner = { address: "0xabc" };
    const options = { waitForConfirmation: false };
    const call = (entrypoint: string): Call => ({ contractAddress: "0x123", entrypoint, calldata: [] });
    await provider.executeAndCheckTransaction(firstSigner, call("first"), undefined, options);
    const next = provider.executeAndCheckTransaction(firstSigner, call("second"), undefined, options);
    await provider.executeAndCheckTransaction({ address: "0xdef" }, call("other"), undefined, options);
    expect(provider.nativeSubmission).toHaveBeenCalledTimes(2);
    expect(provider.nativeSubmission.mock.calls.map(([signer]: any[]) => signer.address)).toEqual(["0xabc", "0xdef"]);
    release({ isReverted: () => false });
    await next;
    expect(provider.nativeSubmission).toHaveBeenCalledTimes(3);
  });

  it("releases a native command barrier and reports a stalled Herald before the next command", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    provider.TRANSACTION_CONFIRM_TIMEOUT_MS = 100;
    provider.nativeSubmission = vi
      .fn()
      .mockResolvedValueOnce({ transaction_hash: "0x1" })
      .mockResolvedValueOnce({ transaction_hash: "0x2" });
    provider.waitForTransactionWithCheckInternal = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ isReverted: () => false });
    const signer = { address: "0xabc" };
    const call = { contractAddress: "0x123", entrypoint: "move", calldata: [] };
    await provider.executeAndCheckTransaction(signer, call, undefined, { waitForConfirmation: false });
    const next = provider.executeAndCheckTransaction(signer, call, undefined, { waitForConfirmation: false });
    expect(provider.nativeSubmission).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(101);
    await next;
    expect(provider.nativeSubmission).toHaveBeenCalledTimes(2);
    expect(findTransactionFailedPayload(provider)?.message).toContain("Herald did not apply transaction 0x1");
    expect(provider.pendingActorExecutionLocks.size).toBe(0);
  });

  it("emits readable submission failures for object-shaped errors", async () => {
    const provider = makeProvider();
    const submitError = {
      message: { code: 40, details: "fallback object message" },
      data: { message: "Execution reverted: insufficient balance" },
    };
    provider.execute = vi.fn().mockRejectedValue(submitError);

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: insufficient balance",
      stage: "submit",
      entrypoints: ["settle"],
      contractAddresses: ["0x1"],
    });
    expect(findTransactionFailedPayload(provider)?.error).toBe(submitError);
  });

  it("aborts the submit when the fee estimate proves a deterministic revert", async () => {
    const provider = makeProvider();
    const estimateError = {
      message: "Transaction execution error",
      data: {
        execution_error:
          "Execution failed. Failure reason: 0x506f70756c6174696f6e2065786365656473206361706163697479 ('Population exceeds capacity').",
      },
    };

    const signer = {
      estimateInvokeFee: vi.fn().mockRejectedValue(estimateError),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBe(estimateError);

    // The estimate already executed the calls and proved they revert — the
    // doomed transaction must never reach the sequencer.
    expect(provider.execute).not.toHaveBeenCalled();
    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: Population exceeds capacity",
      stage: "submit",
    });
  });

  it("prefers nested revert reason over generic short rpc messages", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue({
      shortMessage: "Transaction execution error",
      details:
        'Transaction execution error: {"transaction_index":0,"execution_error":"Nested error: (0x617267656e742f6d756c746963616c6c2d6661696c6564 (\'argent/multicall-failed\'), 0x3, \\"one of the tiles in path is occupied\\", 0x454e545259504f494e545f4641494c4544 (\'ENTRYPOINT_FAILED\'))"}',
    });

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: one of the tiles in path is occupied",
      stage: "submit",
    });
  });

  it("extracts hex-annotated starknet nested reasons before generic rpc text", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue({
      shortMessage: "Transaction execution error",
      details:
        `Transaction execution error: {"transaction_index":0,"execution_error":"Nested error: ` +
        `(0x617267656e742f6d756c746963616c6c2d6661696c6564 ('argent/multicall-failed'), ` +
        `0x0 (''), 0x506f70756c6174696f6e2065786365656473206361706163697479 ('Population exceeds capacity'), ` +
        `0x454e545259504f494e545f4641494c4544 ('ENTRYPOINT_FAILED'))"}`,
    });

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: Population exceeds capacity",
      stage: "submit",
    });
  });

  it("extracts the innermost katana failure reason frame", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue({
      shortMessage: "Transaction execution error",
      details:
        `Transaction execution error: {"transaction_index":0,"execution_error":"Contract error: ` +
        `Failure reason: 0x454e545259504f494e545f4641494c4544 ('ENTRYPOINT_FAILED').\\n` +
        `Execution failed. Failure reason: 0x506f70756c6174696f6e2065786365656473206361706163697479 ('Population exceeds capacity')."}`,
    });

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: Population exceeds capacity",
      stage: "submit",
    });
  });

  it("does not surface protocol error codes when no readable reason is available", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue(new Error("Transaction failed with reason: ENTRYPOINT_FAILED"));

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: Unknown error",
      stage: "submit",
    });
  });

  it("falls back for wrapped generic string errors without serializing quotes", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue("Transaction failed to submit: Unknown error");

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      message: "Transaction failed to submit: Unknown error",
      stage: "submit",
    });
  });

  it("emits revert payloads with transaction hash after submission", async () => {
    const provider = makeProvider();
    provider.transactionStreamWaiter = vi.fn().mockResolvedValue({
      block: null,
      hash: "0xabc",
      status: "REVERTED",
      revertReason: "Execution reverted: realm occupied",
    });
    provider.waitForTransactionWithCheckInternal =
      EternumProvider.prototype["waitForTransactionWithCheckInternal"].bind(provider);
    provider.waitForTransactionWithTimeout = EternumProvider.prototype["waitForTransactionWithTimeout"].bind(provider);

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toThrow(
      "Transaction failed with reason: realm occupied",
    );

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      transactionHash: "0xabc",
      stage: "revert",
      message: "realm occupied",
      revertReason: "Execution reverted: realm occupied",
    });
    expect(findTransactionFailedPayload(provider)?.error).toBeInstanceOf(Error);
  });

  it("resolves each player's ticket independently when a batch includes a rejection", async () => {
    const provider = makeProvider();
    const tickets = [
      { gameId: "7", actor: "0x111", nonce: "3", order: "8" },
      { gameId: "7", actor: "0x222", nonce: "5", order: "9" },
      { gameId: "7", actor: "0x333", nonce: "1", order: "10" },
    ];
    provider.nativeSubmission = vi.fn(async (actor: { address: string }) => ({
      transaction_hash: "0xabc",
      ticket: tickets.find((ticket) => ticket.actor === actor.address),
    }));
    provider.transactionStreamWaiter.mockResolvedValue({
      hash: "0xabc",
      block: null,
      status: "PRE_CONFIRMED",
      executions: tickets.map((ticket, index) => ({
        ...ticket,
        nonceConsumed: true,
        status: index === 1 ? "REVERTED" : "SUCCEEDED",
        reason: index === 1 ? "GAMEPLAY_REJECTED" : "",
        ...(index === 0 ? { batchRemaining: "9" } : index === 2 ? { batchRemaining: "0" } : {}),
      })),
    });
    provider.waitForTransactionWithCheckInternal =
      EternumProvider.prototype["waitForTransactionWithCheckInternal"].bind(provider);
    provider.waitForTransactionWithTimeout = EternumProvider.prototype["waitForTransactionWithTimeout"].bind(provider);
    const results = await Promise.allSettled(
      tickets.map((ticket) =>
        provider.executeAndCheckTransaction(
          { address: ticket.actor },
          { contractAddress: "0x1", entrypoint: "CloseSeason", calldata: [] },
        ),
      ),
    );
    expect(results[0]).toMatchObject({
      status: "fulfilled",
      value: { transaction_hash: "0xabc", batch_remaining: "9" },
    });
    expect(results[1]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: expect.stringContaining("GAMEPLAY_REJECTED") }),
    });
    expect(results[2]).toMatchObject({
      status: "fulfilled",
      value: { transaction_hash: "0xabc", batch_remaining: "0" },
    });
    expect(provider.pendingActorExecutionLocks.size).toBe(0);
  });

  it("keeps ticket identity when a submission completes after its timeout", async () => {
    const provider = makeProvider();
    const ticket = { gameId: "7", actor: "0x111", nonce: "3", order: "8" };
    provider.observeLateSubmittedTransaction(Promise.resolve({ transaction_hash: "0xabc", ticket }), {});
    await vi.waitFor(() =>
      expect(provider.waitForTransactionWithCheckInternal).toHaveBeenCalledWith(
        "0xabc",
        expect.objectContaining({ recoveredFromSubmissionTimeout: true }),
        ticket,
      ),
    );
  });

  it("marks asynchronous post-timeout confirmation failures as background confirmation", async () => {
    const provider = makeProvider();
    let rejectWait!: (error: unknown) => void;
    provider.waitForTransactionWithCheckInternal = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectWait = reject;
        }),
    );
    provider.waitForTransactionWithTimeout = vi.fn().mockResolvedValue({ status: "pending" });

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    const pendingResult = await provider.executeAndCheckTransaction(signer, call);
    expect(pendingResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0xabc",
    });

    rejectWait(new Error("confirmation failed"));
    await Promise.resolve();
    await Promise.resolve();

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      transactionHash: "0xabc",
      stage: "background_confirmation",
      message: "confirmation failed",
    });
  });

  it("times out stuck submissions before a transaction hash so the queue can drain later actions", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    provider.promiseQueue = new PromiseQueue(provider, { batchDelayMs: 0 });
    provider.TRANSACTION_SUBMIT_TIMEOUT_MS = 50;
    provider.execute = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ transaction_hash: "0xnext" });

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const firstCall: Call = {
      contractAddress: "0x1",
      entrypoint: "set_entity_name",
      calldata: [],
    };
    const secondCall: Call = {
      contractAddress: "0x1",
      entrypoint: "set_address_name",
      calldata: [],
    };

    const firstResult = provider.promiseQueue
      .enqueue({
        signer,
        calls: firstCall,
        transactionType: TransactionType.SET_ENTITY_NAME,
      })
      .then(
        () => "resolved",
        (error: unknown) => error,
      );

    await vi.advanceTimersByTimeAsync(0);
    expect(provider.execute).toHaveBeenCalledTimes(1);

    const secondResult = provider.promiseQueue.enqueue({
      signer,
      calls: secondCall,
      transactionType: TransactionType.SET_ADDRESS_NAME,
    });

    await vi.advanceTimersByTimeAsync(50);
    const timedOutFirstResult = await Promise.race([firstResult, Promise.resolve("still-pending")]);

    expect(timedOutFirstResult).toBeInstanceOf(Error);
    expect((timedOutFirstResult as Error).message).toContain("Transaction submission timed out");
    await expect(secondResult).resolves.toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0xnext",
    });
    expect(provider.execute).toHaveBeenCalledTimes(2);
    expect(findTransactionFailedPayload(provider)).toMatchObject({
      stage: "submit",
      message: expect.stringContaining("Transaction submission timed out"),
      failureKind: "submission_timeout_no_hash",
      hasTxHash: false,
      retrySafety: "unsafe_until_wallet_checked",
    });
  });

  it("classifies destroyed provider connections before a transaction hash", async () => {
    const provider = makeProvider();
    provider.execute = vi
      .fn()
      .mockRejectedValue(new Error("Unable to send execute() call due to destroyed connection"));

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "allocate_shares",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toThrow("destroyed connection");

    expect(findTransactionFailedPayload(provider)).toMatchObject({
      stage: "submit",
      failureKind: "provider_connection_destroyed",
      providerState: "destroyed",
      hasTxHash: false,
      retrySafety: "safe_after_reconnect",
    });
  });

  it("emits a late submitted and pending event when a timed-out submission later returns a hash", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    provider.TRANSACTION_SUBMIT_TIMEOUT_MS = 50;

    let resolveExecute!: (value: { transaction_hash: string }) => void;
    provider.execute = vi.fn(() => {
      return new Promise<{ transaction_hash: string }>((resolve) => {
        resolveExecute = resolve;
      });
    });

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "set_entity_name",
      calldata: [],
    };

    const timedOutSubmission = provider
      .executeAndCheckTransaction(signer, call, undefined, { waitForConfirmation: false })
      .then(
        () => "resolved",
        (error: unknown) => error,
      );

    await vi.advanceTimersByTimeAsync(50);
    await expect(timedOutSubmission).resolves.toBeInstanceOf(Error);

    resolveExecute({ transaction_hash: "0xlate" });
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.emit).toHaveBeenCalledWith(
      "transactionSubmitted",
      expect.objectContaining({
        transactionHash: "0xlate",
        recoveredFromSubmissionTimeout: true,
      }),
    );
    expect(provider.emit).toHaveBeenCalledWith(
      "transactionPending",
      expect.objectContaining({
        transactionHash: "0xlate",
        recoveredFromSubmissionTimeout: true,
      }),
    );
  });

  it("waits for a registered pre-submit guard before calling execute", async () => {
    const provider = makeProvider();
    let releaseGuard!: () => void;
    provider.transactionSubmitGuard = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseGuard = resolve;
        }),
    );

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "allocate_shares",
      calldata: [],
    };

    const result = provider.executeAndCheckTransaction(signer, call, undefined, { waitForConfirmation: false });
    await Promise.resolve();

    expect(provider.transactionSubmitGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: TransactionType.ALLOCATE_SHARES,
      }),
    );
    expect(provider.execute).not.toHaveBeenCalled();

    releaseGuard();
    await expect(result).resolves.toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0xabc",
    });
    expect(provider.execute).toHaveBeenCalledTimes(1);
  });

  it("uses default v3 execution details when fee estimation stalls before submission", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    provider.FEE_ESTIMATE_TIMEOUT_MS = 50;

    const signer = {
      estimateInvokeFee: vi.fn(() => new Promise(() => {})),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle",
      calldata: [],
    };

    const result = provider
      .executeAndCheckTransaction(signer, call, undefined, {
        waitForConfirmation: false,
      })
      .then(
        (value: unknown) => value,
        (error: unknown) => error,
      );

    await vi.advanceTimersByTimeAsync(50);
    const timedOutEstimateResult = await Promise.race([result, Promise.resolve("still-pending")]);

    expect(timedOutEstimateResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0xabc",
    });
    expect(provider.execute).toHaveBeenCalledWith(signer, call, { version: 3, tip: 0 });
  });

  it("reuses cached explore resource bounds on subsequent submissions", async () => {
    const provider = makeProvider();

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const calls: Call[] = [
      {
        contractAddress: "0x999",
        entrypoint: "request_random",
        calldata: ["0x123", 1, "0xfeed"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_move",
        calldata: [42, [0], 1],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_extract_reward",
        calldata: [42],
      },
    ];

    await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });
    await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(1);
    expect(provider.execute).toHaveBeenCalledTimes(2);
    expect(signer.estimateInvokeFee).toHaveBeenCalledWith(calls, { version: 3, tip: 0 });
    expect(provider.execute.mock.calls[0][2].tip).toBe(0);
    expect(provider.execute.mock.calls[1][2].tip).toBe(0);
    expect(provider.execute.mock.calls[0][2]).toMatchObject(provider.execute.mock.calls[1][2]);
  });

  it("does not reuse cached explore resource bounds across distinct explore payloads", async () => {
    const provider = makeProvider();

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi
        .fn()
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(10n),
        })
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(20n),
        }),
    };
    const firstCalls: Call[] = [
      {
        contractAddress: "0x999",
        entrypoint: "request_random",
        calldata: ["0x123", 1, "0xfeed"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_move",
        calldata: [42, [0], 1],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_extract_reward",
        calldata: [42],
      },
    ];
    const secondCalls: Call[] = [
      {
        contractAddress: "0x999",
        entrypoint: "request_random",
        calldata: ["0x123", 1, "0xbeef"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_move",
        calldata: [43, [1], 1],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_extract_reward",
        calldata: [43],
      },
    ];

    await provider.executeAndCheckTransaction(signer, firstCalls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });
    await provider.executeAndCheckTransaction(signer, secondCalls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(2);
    expect(provider.execute.mock.calls[0][2].resourceBounds.l2_gas.max_amount).toBe(15n);
    expect(provider.execute.mock.calls[1][2].resourceBounds.l2_gas.max_amount).toBe(30n);
  });

  it("refreshes cached explore resource bounds after a nonce retry", async () => {
    const provider = makeProvider();
    provider.retryConfig = {
      maxRetries: 1,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitterFactor: 0,
    };

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi
        .fn()
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(10n),
        })
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(20n),
        }),
    };
    const calls: Call[] = [
      {
        contractAddress: "0x999",
        entrypoint: "request_random",
        calldata: ["0x123", 1, "0xfeed"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_move",
        calldata: [42, [0], 1],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_extract_reward",
        calldata: [42],
      },
    ];

    provider.execute = vi
      .fn()
      .mockRejectedValueOnce(new Error("nonce too old"))
      .mockResolvedValueOnce({ transaction_hash: "0xabc" });

    await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(2);
    expect(provider.execute.mock.calls[0][2].resourceBounds.l2_gas.max_amount).toBe(15n);
    expect(provider.execute.mock.calls[1][2].resourceBounds.l2_gas.max_amount).toBe(30n);
  });

  it("invalidates cached explore resource bounds after a fee-related submit failure", async () => {
    const provider = makeProvider();

    const signer = {
      address: "0xabc",
      estimateInvokeFee: vi
        .fn()
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(10n),
        })
        .mockResolvedValueOnce({
          resourceBounds: makeResourceBounds(20n),
        }),
    };
    const calls: Call[] = [
      {
        contractAddress: "0x999",
        entrypoint: "request_random",
        calldata: ["0x123", 1, "0xfeed"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_move",
        calldata: [42, [0], 1],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explorer_extract_reward",
        calldata: [42],
      },
    ];

    await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });

    provider.execute = vi.fn().mockRejectedValueOnce(new Error("max fee too low"));
    await expect(
      provider.executeAndCheckTransaction(signer, calls, undefined, {
        waitForConfirmation: false,
        transactionType: TransactionType.EXPLORE,
      }),
    ).rejects.toThrow(/max fee too low/i);

    provider.execute = vi.fn().mockResolvedValueOnce({ transaction_hash: "0xdef" });
    await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
      transactionType: TransactionType.EXPLORE,
    });

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(2);
    expect(provider.execute.mock.calls[0][2].resourceBounds.l2_gas.max_amount).toBe(30n);
  });
});
