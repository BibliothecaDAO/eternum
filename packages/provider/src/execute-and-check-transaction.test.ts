import type { Abi, AccountInterface, Call } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { ActionOutcomeUnknownError, EternumProvider } from "./index";
import type { TransactionStreamWaiter } from "./types";

const makeProvider = (scope: NonNullable<ConstructorParameters<typeof EternumProvider>[3]> = {}) =>
  new EternumProvider({ world: "0x77" }, "http://127.0.0.1:1", { gameId: 7, ...scope });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("provider submission boundary", () => {
  it("refuses a command before the shard's signed-intent submission is configured", async () => {
    const execute = vi.fn();
    const signer = { address: "0x111", execute } as unknown as AccountInterface;
    const calls: Call = { contractAddress: "0x77", entrypoint: "settle", calldata: [] };
    await expect(makeProvider().promiseQueue.enqueue({ signer, calls })).rejects.toThrow(
      "Native submission is not configured",
    );
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
        statusClass: index === 0 ? "GAMEPLAY_REJECTED" : "",
        reason: index === 0 ? "not enough stamina" : "",
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
      message: expect.stringContaining("not enough stamina"),
    });
    expect(submitted.mock.calls.map(([event]) => event.ticket)).toEqual(tickets);
  });

  it("keeps a slow action pending with no timeout and signs the next only after Herald applies it", async () => {
    vi.useFakeTimers();
    const provider = makeProvider();
    const ticket = { gameId: "7", actor: "0x111", nonce: "0", order: "1" };
    let admit!: (value: { transaction_hash: string; ticket: typeof ticket }) => void;
    const admission = new Promise<{ transaction_hash: string; ticket: typeof ticket }>((resolve) => {
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
    admit({ transaction_hash: "0xabc", ticket });
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledOnce();
    apply({
      hash: "0xabc",
      block: 5,
      status: "PRE_CONFIRMED",
      executions: [{ ...ticket, nonceConsumed: true, status: "SUCCEEDED", statusClass: "", reason: "" }],
    });
    await Promise.all([slow, next]);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(failed).not.toHaveBeenCalled();
    // Admission to visible runs from sending the ticket to the stream reporting its outcome.
    expect(completed.mock.calls[0][0].admissionToVisibleMs).toBe(70_000);
  });

  it("reports an intent with no outcome as unknown, never as a failed submit to retry", async () => {
    const provider = makeProvider();
    provider.setNativeSubmission(
      vi.fn().mockRejectedValue(new ActionOutcomeUnknownError("0x1")),
      bindings.commandAbi as Abi,
      () => 9,
    );
    const failed = vi.fn();
    provider.on("transactionFailed", failed);
    await expect(
      provider.claim_wonder_points({ signer: { address: "0x111" } as AccountInterface, value: 1 }),
    ).rejects.toThrow(ActionOutcomeUnknownError);
    expect(failed.mock.calls[0][0]).toMatchObject({ stage: "submit", failureKind: "action_outcome_unknown" });
  });
});
