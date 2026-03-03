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
  it("bumps l2 gas max_amount when fee estimation returns a low cap", async () => {
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
    expect(txDetails.resourceBounds.l2_gas.max_amount).toBeGreaterThan(1_225_966_400n);
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

  it("serializes VRF submissions for the same signer/source when waitForConfirmation is false", async () => {
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
    expect(provider.execute).toHaveBeenCalledTimes(1);

    resolveFirstWait({ isReverted: () => false });

    const secondResult = await secondPromise;
    expect(secondResult).toMatchObject({
      statusReceipt: "PENDING",
      transaction_hash: "0x2",
    });
    expect(provider.execute).toHaveBeenCalledTimes(2);
  });
});
