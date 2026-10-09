import type { Abi, AccountInterface, Call } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
import type { TransactionStreamWaiter } from "./types";

const makeProvider = (scope: NonNullable<ConstructorParameters<typeof EternumProvider>[3]> = {}) =>
  new EternumProvider({ world: "0x77" }, "http://127.0.0.1:1", { gameId: 7, ...scope });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("provider submission boundary", () => {
  it("refuses a command before the shard's play submission is configured", async () => {
    const execute = vi.fn();
    const signer = { address: "0x111", execute } as unknown as AccountInterface;
    const calls: Call = { contractAddress: "0x77", entrypoint: "settle", calldata: [] };
    await expect(makeProvider().promiseQueue.enqueue({ signer, calls })).rejects.toThrow(
      "Native submission is not configured",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("holds one player's next command until its outcome, and a reverted one fails with its reason", async () => {
    const provider = makeProvider();
    const outcomes = new Map<string, (value: Awaited<ReturnType<TransactionStreamWaiter>>) => void>();
    let sent = 0;
    const submit = vi.fn(async () => ({ transaction_hash: `0x${(sent += 1)}` }));
    provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
    provider.setTransactionStreamWaiter((hash) => new Promise((resolve) => outcomes.set(hash, resolve)));
    const complete = vi.fn(),
      failed = vi.fn();
    provider.on("transactionComplete", complete);
    provider.on("transactionFailed", failed);
    const signer = { address: "0x111" } as AccountInterface;
    const first = provider.claim_wonder_points({ signer, value: 1 }).catch(() => undefined);
    const next = provider.claim_wonder_points({ signer, value: 2 });
    const other = provider.claim_wonder_points({ signer: { address: "0x222" } as AccountInterface, value: 3 });
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls.map(([actor]) => (actor as AccountInterface).address)).toEqual(["0x111", "0x222"]);

    outcomes.get("0x1")!({ hash: "0x1", block: 4, status: "REVERTED", revertReason: "not enough stamina" });
    await first;
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    outcomes.get("0x2")!({ hash: "0x2", block: 4, status: "PRE_CONFIRMED" });
    outcomes.get("0x3")!({ hash: "0x3", block: 5, status: "PRE_CONFIRMED" });
    await Promise.all([next, other]);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(failed).toHaveBeenCalledOnce();
    expect(failed.mock.calls[0][0]).toMatchObject({
      signerAddress: "0x111",
      stage: "revert",
      transactionHash: "0x1",
      message: expect.stringContaining("not enough stamina"),
    });
  });

  it("keeps a slow action pending with no timeout and signs the next only after Herald applies it", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    let admit!: (value: { transaction_hash: string }) => void;
    const admission = new Promise<{ transaction_hash: string }>((resolve) => {
      admit = resolve;
    });
    const submit = vi.fn().mockReturnValueOnce(admission).mockResolvedValue({ transaction_hash: "0xdef" });
    provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
    let apply!: (value: Awaited<ReturnType<TransactionStreamWaiter>>) => void;
    provider.setTransactionStreamWaiter(async (hash) =>
      hash === "0xabc"
        ? new Promise((resolve) => {
            apply = resolve;
          })
        : { hash, block: 6, status: "PRE_CONFIRMED" },
    );
    const failed = vi.fn();
    const completed = vi.fn();
    provider.on("transactionFailed", failed);
    provider.on("transactionComplete", completed);
    const signer = { address: "0x111" } as AccountInterface;
    const slow = provider.claim_wonder_points({ signer, value: 1 });
    const next = provider.claim_wonder_points({ signer, value: 2 });
    await vi.advanceTimersByTimeAsync(70_000);
    admit({ transaction_hash: "0xabc" });
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledOnce();
    apply({ hash: "0xabc", block: 5, status: "PRE_CONFIRMED" });
    await Promise.all([slow, next]);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(failed).not.toHaveBeenCalled();
    // Admission to visible runs from sending the invoke to the stream reporting its outcome.
    expect(completed.mock.calls[0][0].admissionToVisibleMs).toBe(70_000);
  });
});
