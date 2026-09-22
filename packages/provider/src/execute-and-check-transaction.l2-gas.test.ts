import type { Abi, AccountInterface, Call, ResourceBoundsBN } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
import type { TransactionStreamWaiter } from "./types";

const makeResourceBounds = (l2GasMaxAmount: bigint): ResourceBoundsBN => ({
  l1_gas: { max_amount: 1n, max_price_per_unit: 1n },
  l1_data_gas: { max_amount: 1n, max_price_per_unit: 1n },
  l2_gas: { max_amount: l2GasMaxAmount, max_price_per_unit: 1n },
});

const makeProvider = (scope: NonNullable<ConstructorParameters<typeof EternumProvider>[3]> = {}) =>
  new EternumProvider({ world: "0x77" }, "http://127.0.0.1:1", undefined, { gameId: 7, ...scope });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("provider submission boundary", () => {
  it("sends bounded zero-tip fees, respects fixed bounds and refuses a proven revert", async () => {
    const provider = makeProvider();
    const estimateInvokeFee = vi.fn().mockResolvedValue({ resourceBounds: makeResourceBounds(1_000_000_000n) });
    const execute = vi.fn().mockResolvedValue({ transaction_hash: "0xabc" });
    const signer = { address: "0x111", estimateInvokeFee, execute } as unknown as AccountInterface;
    const calls: Call = { contractAddress: "0x77", entrypoint: "settle", calldata: [] };
    expect(await provider.promiseQueue.enqueue({ signer, calls })).toMatchObject({
      transaction_hash: "0xabc",
      statusReceipt: "PENDING",
    });
    expect(estimateInvokeFee).toHaveBeenCalledWith(calls, { version: 3, tip: 0 });
    expect(execute).toHaveBeenLastCalledWith(calls, {
      version: 3,
      tip: 0,
      resourceBounds: makeResourceBounds(1_200_000_000n),
    });

    estimateInvokeFee.mockClear();
    const resourceBounds = makeResourceBounds(123n);
    await makeProvider({ executionResourceBounds: resourceBounds }).promiseQueue.enqueue({ signer, calls });
    expect(estimateInvokeFee).not.toHaveBeenCalled();
    expect(execute).toHaveBeenLastCalledWith(calls, { version: 3, tip: 0, resourceBounds });

    execute.mockClear();
    const revert = {
      message: "Transaction execution error",
      data: { execution_error: "Execution failed. Failure reason: ('Population exceeds capacity')." },
    };
    estimateInvokeFee.mockRejectedValue(revert);
    await expect(provider.promiseQueue.enqueue({ signer, calls })).rejects.toBe(revert);
    expect(execute).not.toHaveBeenCalled();
  });

  it("holds one player's next command until its outcome and separates rejected tickets in a shared transaction", async () => {
    const provider = makeProvider();
    let release!: (value: Awaited<ReturnType<TransactionStreamWaiter>>) => void;
    const receipt = new Promise<Awaited<ReturnType<TransactionStreamWaiter>>>((resolve) => {
      release = resolve;
    });
    const tickets = [
      { gameId: "7", actor: "0x111", nonce: "0", order: "1" },
      { gameId: "7", actor: "0x222", nonce: "0", order: "2" },
      { gameId: "7", actor: "0x111", nonce: "1", order: "3" },
    ];
    let firstActorSubmissions = 0;
    const submit = vi.fn(async (actor: AccountInterface) => ({
      transaction_hash: "0xabc",
      ticket: tickets[actor.address === "0x222" ? 1 : firstActorSubmissions++ === 0 ? 0 : 2],
    }));
    provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
    provider.setTransactionStreamWaiter(() => receipt);
    const submitted = vi.fn(),
      complete = vi.fn(),
      failed = vi.fn();
    provider.on("transactionSubmitted", submitted);
    provider.on("transactionComplete", complete);
    provider.on("transactionFailed", failed);
    const signer = { address: "0x111" } as AccountInterface;
    await provider.claim_wonder_points({ signer, value: 1 });
    const next = provider.claim_wonder_points({ signer, value: 2 });
    await provider.claim_wonder_points({ signer: { address: "0x222" } as AccountInterface, value: 3 });
    expect(submit.mock.calls.map(([actor]) => actor.address)).toEqual(["0x111", "0x222"]);
    expect(complete).not.toHaveBeenCalled();
    release({
      hash: "0xabc",
      block: 4,
      status: "PRE_CONFIRMED",
      executions: tickets.map((ticket, index) => ({
        ...ticket,
        nonceConsumed: true,
        status: index === 0 ? "REVERTED" : "SUCCEEDED",
        reason: index === 0 ? "GAMEPLAY_REJECTED" : "",
        batchRemaining: "0",
      })),
    });
    await next;
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(failed).toHaveBeenCalledOnce();
    expect(failed.mock.calls[0][0]).toMatchObject({
      signerAddress: "0x111",
      stage: "revert",
      transactionHash: "0xabc",
      message: expect.stringContaining("GAMEPLAY_REJECTED"),
    });
    expect(submitted.mock.calls.map(([event]) => event.ticket)).toEqual(tickets);
  });

  it("keeps the next command behind a late admission until its recorded outcome", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    const ticket = { gameId: "7", actor: "0x111", nonce: "0", order: "1" };
    let admit!: (value: { transaction_hash: string; ticket: typeof ticket }) => void;
    const pending = new Promise<{ transaction_hash: string; ticket: typeof ticket }>((resolve) => {
      admit = resolve;
    });
    const submit = vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ transaction_hash: "0xdef" });
    provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
    let confirm!: (value: Awaited<ReturnType<TransactionStreamWaiter>>) => void;
    provider.setTransactionStreamWaiter(async (hash) =>
      hash === "0xabc"
        ? new Promise((resolve) => {
            confirm = resolve;
          })
        : { hash, block: 5, status: "PRE_CONFIRMED" },
    );
    const submitted = vi.fn(),
      failed = vi.fn();
    provider.on("transactionSubmitted", submitted);
    provider.on("transactionFailed", failed);
    const signer = { address: "0x111" } as AccountInterface;
    const rejected = expect(provider.claim_wonder_points({ signer, value: 1 })).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(20_001);
    await rejected;
    admit({ transaction_hash: "0xabc", ticket });
    await vi.advanceTimersByTimeAsync(0);
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ transactionHash: "0xabc", ticket }));
    const next = provider.claim_wonder_points({ signer, value: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledOnce();
    confirm({
      hash: "0xabc",
      block: 5,
      status: "PRE_CONFIRMED",
      executions: [{ ...ticket, nonceConsumed: true, status: "SUCCEEDED", reason: "" }],
    });
    await vi.advanceTimersByTimeAsync(0);
    await next;
    expect(submit).toHaveBeenCalledTimes(2);
    expect(failed.mock.calls[0][0].failureKind).toBe("submission_timeout_no_hash");
  });
  it("releases a stalled stream barrier and reports the failure before another command", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    const submit = vi.fn(async () => ({ transaction_hash: "0xabc" }));
    provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
    provider.setTransactionStreamWaiter(() => new Promise(() => {}));
    const failed = vi.fn();
    provider.on("transactionFailed", failed);
    const signer = { address: "0x111" } as AccountInterface;
    const first = provider.claim_wonder_points({ signer, value: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await first;
    const next = provider.claim_wonder_points({ signer, value: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_001);
    await next;
    expect(submit).toHaveBeenCalledTimes(2);
    expect(failed.mock.calls.some(([event]) => event.message.includes("Herald"))).toBe(true);
    await vi.advanceTimersByTimeAsync(10_001);
  });
});
