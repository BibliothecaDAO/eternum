import { byteArray, hash, shortString } from "starknet";
import { describe, expect, it, vi } from "vitest";

import { executeGameplayAccountTransaction } from "./submit";
import { waitForActionOutcome } from "./transaction-outcome";

const GAMES = "0x77";
const TX = "0xabc";
const byteArrayFields = (text: string) => {
  const encoded = byteArray.byteArrayFromString(text);
  return [
    String(encoded.data.length),
    ...encoded.data.map(String),
    String(encoded.pending_word),
    String(encoded.pending_word_len),
  ];
};
const receipt = (overrides: Record<string, unknown> = {}) => ({
  transaction_hash: TX,
  block_number: 12,
  execution_status: "SUCCEEDED",
  finality_status: "PRE_CONFIRMED",
  events: [] as unknown[],
  ...overrides,
});
const rpcAnswering = (answer: ReturnType<typeof receipt>) => ({
  getTransactionReceipt: vi.fn(async () => answer as never),
});
const running = new AbortController().signal;
const runtimeWith = (status: Promise<{ block: number | null; hash: string; status: string }>) => {
  let resync = (_throughBlock: number) => {};
  return {
    waitForTransaction: vi.fn(() => status),
    subscribeResynced: vi.fn((listener: (throughBlock: number) => void) => {
      resync = listener;
      return () => {};
    }),
    resync: (throughBlock: number) => resync(throughBlock),
  };
};

describe("an action's outcome", () => {
  it("ends a reverted action with its revert reason, without waiting for Herald", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = rpcAnswering(receipt({ execution_status: "REVERTED", revert_reason: "stale release" }));
    await expect(waitForActionOutcome(runtime, rpc, GAMES, TX, running)).resolves.toMatchObject({
      status: "REVERTED",
      revertReason: "stale release",
    });
    expect(runtime.waitForTransaction).not.toHaveBeenCalled();
  });

  it("ends an action the game refused with the game's reason: nothing of it applied", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rejected = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", TX],
      data: [shortString.encodeShortString("GAMEPLAY_REJECTED"), ...byteArrayFields("explorer is dead")],
    };
    const rpc = rpcAnswering(receipt({ events: [rejected] }));
    await expect(waitForActionOutcome(runtime, rpc, GAMES, TX, running)).resolves.toMatchObject({
      status: "REJECTED",
      revertReason: "explorer is dead",
    });
    expect(runtime.waitForTransaction).not.toHaveBeenCalled();
  });

  it("never treats a malformed library result as applied: it ends refused with its class", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const invalid = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", TX],
      data: [shortString.encodeShortString("INVALID_GAMEPLAY_RESULT"), ...byteArrayFields("INVALID_GAMEPLAY_RESULT")],
    };
    await expect(
      waitForActionOutcome(runtime, rpcAnswering(receipt({ events: [invalid] })), GAMES, TX, running),
    ).resolves.toMatchObject({
      status: "REJECTED",
      revertReason: "INVALID_GAMEPLAY_RESULT",
    });
  });

  it("settles an applied action once Herald has applied it, with what a batch still has to do", async () => {
    let applied!: (status: { block: number; hash: string; status: string }) => void;
    const runtime = runtimeWith(new Promise((resolve) => (applied = resolve)));
    const progress = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("BatchProgress"), "0x7"],
      data: ["0x111", TX, "3"],
    };
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ events: [progress] })), GAMES, TX, running);
    await vi.waitFor(() => expect(runtime.waitForTransaction).toHaveBeenCalledWith(TX));
    applied({ block: 12, hash: TX, status: "PRE_CONFIRMED" });
    await expect(outcome).resolves.toEqual({ hash: TX, block: 12, status: "SUCCEEDED", batchRemaining: "3" });
  });

  it("settles an applied action from a fresh snapshot that covers its receipt's block", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ block_number: 12 })), GAMES, TX, running);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(12);
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it("stays pending after a reconnect whose snapshot is older than the receipt, until Herald applies it", async () => {
    let applied!: (status: { block: number; hash: string; status: string }) => void;
    const runtime = runtimeWith(new Promise((resolve) => (applied = resolve)));
    let settled = false;
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ block_number: 12 })), GAMES, TX, running);
    void outcome.then(() => (settled = true));
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    // The snapshot describes block 11: the action's facts are not in the store yet.
    runtime.resync(11);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    applied({ block: 12, hash: TX, status: "ACCEPTED_ON_L2" });
    await expect(outcome).resolves.toEqual({ hash: TX, block: 12, status: "SUCCEEDED" });
  });

  it("never settles a pre-confirmed receipt with no block from a snapshot; only Herald's status does", async () => {
    let applied!: (status: { block: number | null; hash: string; status: string }) => void;
    const runtime = runtimeWith(new Promise((resolve) => (applied = resolve)));
    let settled = false;
    const outcome = waitForActionOutcome(
      runtime,
      rpcAnswering(receipt({ block_number: undefined })),
      GAMES,
      TX,
      running,
    );
    void outcome.then(() => (settled = true));
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(Number.MAX_SAFE_INTEGER);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    applied({ block: null, hash: TX, status: "PRE_CONFIRMED" });
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it("stays pending while the receipt is not found, and stops when the client does", async () => {
    vi.useFakeTimers();
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = { getTransactionReceipt: vi.fn(async () => Promise.reject(new Error("Transaction hash not found"))) };
    const client = new AbortController();
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, client.signal);
    const ended = expect(outcome).rejects.toThrow("disposed");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(rpc.getTransactionReceipt.mock.calls.length).toBeGreaterThan(1);
    client.abort(new Error("Game client disposed"));
    await ended;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe("a dropped action", () => {
  /** Sends at nonce 7 a transaction no block will hold; the account's nonce moves on once `passed` says so. */
  const sendFrom = async (address: string, transactionHash: string, passed: () => boolean) => {
    const account = {
      address,
      execute: vi.fn(async () => ({ transaction_hash: transactionHash })),
      getNonce: vi.fn(async () => "0x7"),
      getNonceForAddress: vi.fn(async () => (passed() ? "0x8" : "0x7")),
      getTransactionStatus: vi.fn(async () => {
        throw new Error("TXN_HASH_NOT_FOUND");
      }),
    };
    await executeGameplayAccountTransaction({
      account,
      calls: { contractAddress: GAMES, entrypoint: "play", calldata: [] },
      shard: { chainId: "0x1", l2GasBound: 1n },
    });
  };

  it("ends dropped once the account's pre-confirmed nonce has passed it with no receipt", async () => {
    await sendFrom("0x5e1", "0xd1", () => true);
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = {
      getTransactionReceipt: vi.fn(async () => {
        throw new Error("TXN_HASH_NOT_FOUND");
      }),
      getNonceForAddress: vi.fn(async () => "0x8"),
    };
    await expect(waitForActionOutcome(runtime, rpc, GAMES, "0xd1", running)).resolves.toMatchObject({
      hash: "0xd1",
      status: "DROPPED",
    });
    expect(rpc.getNonceForAddress).toHaveBeenCalledWith("0x5e1", "pre_confirmed");
    expect(runtime.waitForTransaction).not.toHaveBeenCalled();
  });

  it("keeps waiting while the nonce has not passed it, and never calls an unknown transaction dropped", async () => {
    let passed = false;
    await sendFrom("0x5e2", "0xd2", () => passed);
    const rpc = {
      getTransactionReceipt: vi.fn(async () => {
        throw new Error("TXN_HASH_NOT_FOUND");
      }),
      getNonceForAddress: vi.fn(async () => "0x7"),
    };
    for (const hash of ["0xd2", "0xe0"]) {
      const stop = new AbortController();
      const outcome = waitForActionOutcome(runtimeWith(new Promise(() => {})), rpc, GAMES, hash, stop.signal);
      await new Promise((resolve) => setTimeout(resolve, 600));
      stop.abort(new Error("stopped"));
      await expect(outcome).rejects.toThrow("stopped");
    }
    expect(rpc.getTransactionReceipt.mock.calls.length).toBeGreaterThan(2);
    passed = true;
  });
});
