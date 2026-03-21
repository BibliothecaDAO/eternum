import type { Call, ResourceBoundsBN } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { EternumProvider } from "./index";

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
  provider.pendingVrfExecutionLocks = new Map();
  provider.TRANSACTION_CONFIRM_TIMEOUT_MS = 10_000;
  return provider;
};

describe("EternumProvider.executeAndCheckTransaction gas bounds", () => {
  it("caps l2 gas max_amount at the current v3 mainnet limit", async () => {
    const provider = makeProvider();
    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle_realms",
      calldata: [],
    };

    await provider.executeAndCheckTransaction(signer, call);

    expect(signer.estimateInvokeFee).toHaveBeenCalledTimes(1);
    const txDetails = provider.execute.mock.calls[0][3];
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
      entrypoint: "settle_realms",
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

  it("serializes non-explore VRF submissions for the same signer/source when waitForConfirmation is false", async () => {
    const provider = makeProvider();
    provider.VRF_PROVIDER_ADDRESS = "0x999";

    let resolveFirstWait!: (value: any) => void;
    const firstWaitPromise = new Promise<any>((resolve) => {
      resolveFirstWait = resolve;
    });

    provider.execute = vi
      .fn()
      .mockResolvedValueOnce({ transaction_hash: "0x1" })
      .mockResolvedValueOnce({ transaction_hash: "0x2" });
    provider.waitForTransactionWithCheckInternal = vi.fn().mockImplementation((transactionHash: string) => {
      if (transactionHash === "0x1") {
        return firstWaitPromise;
      }
      return Promise.resolve({ isReverted: () => false });
    });

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
        calldata: ["0x123", 0, "0xabc"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "open_chest",
        calldata: [],
      },
    ];

    const firstResult = await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
    });
    expect(firstResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0x1",
    });
    expect(provider.execute).toHaveBeenCalledTimes(1);

    const secondPromise = provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(provider.execute).toHaveBeenCalledTimes(1);

    resolveFirstWait({ isReverted: () => false });

    const secondResult = await secondPromise;
    expect(secondResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0x2",
    });
    expect(provider.execute).toHaveBeenCalledTimes(2);
  });

  it("does not serialize explore VRF submissions when waitForConfirmation is false", async () => {
    const provider = makeProvider();
    provider.VRF_PROVIDER_ADDRESS = "0x999";

    let resolveFirstWait!: (value: any) => void;
    const firstWaitPromise = new Promise<any>((resolve) => {
      resolveFirstWait = resolve;
    });

    provider.execute = vi
      .fn()
      .mockResolvedValueOnce({ transaction_hash: "0x1" })
      .mockResolvedValueOnce({ transaction_hash: "0x2" });
    provider.waitForTransactionWithCheckInternal = vi.fn().mockImplementation((transactionHash: string) => {
      if (transactionHash === "0x1") {
        return firstWaitPromise;
      }
      return Promise.resolve({ isReverted: () => false });
    });

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
        calldata: ["0x123", 0, "0xabc"],
      },
      {
        contractAddress: "0x123",
        entrypoint: "explore",
        calldata: [],
      },
    ];

    const firstResult = await provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
    });
    expect(firstResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0x1",
    });
    expect(provider.execute).toHaveBeenCalledTimes(1);

    const secondPromise = provider.executeAndCheckTransaction(signer, calls, undefined, {
      waitForConfirmation: false,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(provider.execute).toHaveBeenCalledTimes(2);

    resolveFirstWait({ isReverted: () => false });

    const secondResult = await secondPromise;
    expect(secondResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0x2",
    });
    expect(provider.execute).toHaveBeenCalledTimes(2);
  });

  it("emits readable submission failures for object-shaped errors", async () => {
    const provider = makeProvider();
    provider.execute = vi.fn().mockRejectedValue({
      message: { code: 40, details: "fallback object message" },
      data: { message: "Execution reverted: insufficient balance" },
    });

    const signer = {
      estimateInvokeFee: vi.fn().mockResolvedValue({
        resourceBounds: makeResourceBounds(1_000_000_000n),
      }),
    };
    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "settle_realms",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    const failedEmit = provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed");
    expect(failedEmit?.[1]).toBe("Transaction failed to submit: insufficient balance");
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
      entrypoint: "settle_realms",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    const failedEmit = provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed");
    expect(failedEmit?.[1]).toBe("Transaction failed to submit: one of the tiles in path is occupied");
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
      entrypoint: "settle_realms",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    const failedEmit = provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed");
    expect(failedEmit?.[1]).toBe("Transaction failed to submit: Population exceeds capacity");
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
      entrypoint: "settle_realms",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    const failedEmit = provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed");
    expect(failedEmit?.[1]).toBe("Transaction failed to submit: Unknown error");
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
      entrypoint: "settle_realms",
      calldata: [],
    };

    await expect(provider.executeAndCheckTransaction(signer, call)).rejects.toBeDefined();

    const failedEmit = provider.emit.mock.calls.find((emitCall: unknown[]) => emitCall[0] === "transactionFailed");
    expect(failedEmit?.[1]).toBe("Transaction failed to submit: Unknown error");
  });
});
