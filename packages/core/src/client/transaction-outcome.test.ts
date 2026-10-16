import { TransactionNotSentError, TransactionType } from "@bibliothecadao/provider";
import { byteArray, hash, shortString } from "starknet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { waitForActionOutcome } from "./transaction-outcome";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
/** The runtime's contract: a resync reaches its listeners, and a new listener hears the last applied snapshot. */
const runtimeWith = (status: Promise<{ block: number | null; hash: string; status: string }>) => {
  const listeners = new Set<(throughBlock: number) => void>();
  let snapshotThroughBlock: number | null = null;
  return {
    waitForTransaction: vi.fn(() => status),
    subscribeResynced: vi.fn((listener: (throughBlock: number) => void) => {
      listeners.add(listener);
      if (snapshotThroughBlock !== null) listener(snapshotThroughBlock);
      return () => listeners.delete(listener);
    }),
    resync: (throughBlock: number) => {
      snapshotThroughBlock = throughBlock;
      listeners.forEach((listener) => listener(throughBlock));
    },
  };
};

describe("an action's outcome", () => {
  it.each(["dropped", "replaced"] as const)(
    "Herald at 300 ms beats a late %s during a 19 s hash gap",
    async (reason) => {
      vi.useFakeTimers();
      const runtime = runtimeWith(
        new Promise((resolve) => setTimeout(() => resolve({ block: null, hash: TX, status: "PRE_CONFIRMED" }), 300)),
      );
      const rpc = {
        getTransactionReceipt: vi.fn(async () => {
          throw new Error("Transaction hash not found");
        }),
      };
      const inBlock = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Transaction ${TX} not sent (${reason})`)), 12_000),
      );
      const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running, inBlock);
      await vi.advanceTimersByTimeAsync(300);
      await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED" });
      const reads = rpc.getTransactionReceipt.mock.calls.length;
      await vi.advanceTimersByTimeAsync(19_000);
      expect(rpc.getTransactionReceipt).toHaveBeenCalledTimes(reads);
      vi.useRealTimers();
    },
  );

  it("a cached Herald status takes precedence over a rejected inclusion promise", async () => {
    const runtime = runtimeWith(Promise.resolve({ block: null, hash: TX, status: "PRE_CONFIRMED" }));
    const rpc = { getTransactionReceipt: vi.fn(() => new Promise<never>(() => {})) };
    await expect(
      waitForActionOutcome(
        runtime,
        rpc,
        GAMES,
        TX,
        running,
        Promise.reject(new Error(`Transaction ${TX} not sent (dropped)`)),
      ),
    ).resolves.toMatchObject({ status: "SUCCEEDED" });
    expect(rpc.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("keeps an inclusion refusal while Herald has said nothing", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = { getTransactionReceipt: vi.fn(() => new Promise<never>(() => {})) };
    await expect(
      waitForActionOutcome(runtime, rpc, GAMES, TX, running, Promise.reject(new TransactionNotSentError(TX))),
    ).rejects.toThrow("The shard refused this action.");
  });

  it("ends a reverted action with its revert reason, without waiting for Herald", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = rpcAnswering(receipt({ execution_status: "REVERTED", revert_reason: "stale release" }));
    const result = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(result).resolves.toMatchObject({
      status: "REVERTED",
      revertReason: "stale release",
    });
  });

  it("ends an action the game refused with the game's reason: nothing of it applied", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rejected = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", TX],
      data: [shortString.encodeShortString("GAMEPLAY_REJECTED"), ...byteArrayFields("explorer is dead")],
    };
    const rpc = rpcAnswering(receipt({ events: [rejected] }));
    const result = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(result).resolves.toMatchObject({
      status: "REJECTED",
      revertReason: "explorer is dead",
    });
  });

  it("never treats a malformed library result as applied: it ends refused with its class", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const invalid = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", TX],
      data: [shortString.encodeShortString("INVALID_GAMEPLAY_RESULT"), ...byteArrayFields("INVALID_GAMEPLAY_RESULT")],
    };
    const result = waitForActionOutcome(runtime, rpcAnswering(receipt({ events: [invalid] })), GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(result).resolves.toMatchObject({
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
    const outcome = waitForActionOutcome(
      runtime,
      rpcAnswering(receipt({ events: [progress] })),
      GAMES,
      TX,
      running,
      undefined,
      TransactionType.END_GAME,
    );
    await vi.waitFor(() => expect(runtime.waitForTransaction).toHaveBeenCalledWith(TX));
    applied({ block: 12, hash: TX, status: "PRE_CONFIRMED" });
    await expect(outcome).resolves.toEqual({ hash: TX, block: 12, status: "SUCCEEDED", batchRemaining: "3" });
  });

  it("retains the receipt grace only for a batch whose progress Herald does not carry", async () => {
    vi.useFakeTimers();
    const runtime = runtimeWith(Promise.resolve({ block: 12, hash: TX, status: "PRE_CONFIRMED" }));
    const progress = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("BatchProgress"), "0x7"],
      data: ["0x111", TX, "3"],
    };
    const rpc = {
      getTransactionReceipt: vi.fn(
        () => new Promise<never>((resolve) => setTimeout(() => resolve(receipt({ events: [progress] }) as never), 500)),
      ),
    };
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running, undefined, TransactionType.END_GAME);
    await vi.advanceTimersByTimeAsync(500);
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED", batchRemaining: "3" });
    vi.useRealTimers();
  });

  it("settles an applied action from a fresh snapshot that covers its receipt's block", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ block_number: 12 })), GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(12);
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it("settles from Herald's applied status while the receipt cannot be read", async () => {
    vi.useFakeTimers();
    const runtime = runtimeWith(Promise.resolve({ block: 12, hash: TX, status: "PRE_CONFIRMED" }));
    const rpc = { getTransactionReceipt: vi.fn(async () => Promise.reject(new Error("RPC read unavailable"))) };
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(0);
    await expect(outcome).resolves.toEqual({ hash: TX, block: 12, status: "SUCCEEDED" });
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("ends an action Herald says applied nothing as refused with its reason, without the receipt", async () => {
    const runtime = runtimeWith(
      Promise.resolve({ block: 12, hash: TX, status: "REJECTED", revertReason: "explorer is dead" }),
    );
    const rpc = { getTransactionReceipt: vi.fn(() => new Promise<never>(() => {})) };
    const result = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(result).resolves.toEqual({
      hash: TX,
      block: 12,
      status: "REJECTED",
      revertReason: "explorer is dead",
    });
  });

  it("falls back to the snapshot watch when the session ends Herald's wait, never failing the action", async () => {
    const runtime = runtimeWith(Promise.reject(new Error("Game sync session was replaced")));
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ block_number: 12 })), GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(12);
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED", block: 12 });
  });

  it("stays pending after a reconnect whose snapshot is older than the receipt, until Herald applies it", async () => {
    let applied!: (status: { block: number; hash: string; status: string }) => void;
    const runtime = runtimeWith(new Promise((resolve) => (applied = resolve)));
    let settled = false;
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt({ block_number: 12 })), GAMES, TX, running);
    void outcome.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    // The snapshot describes block 11: the action's facts are not in the store yet.
    runtime.resync(11);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    applied({ block: 12, hash: TX, status: "ACCEPTED_ON_L2" });
    await expect(outcome).resolves.toEqual({ hash: TX, block: 12, status: "SUCCEEDED" });
  });

  it("settles from a reconnect that finished while the receipt was still being read", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    let answerReceipt!: (value: ReturnType<typeof receipt>) => void;
    const rpc = {
      getTransactionReceipt: vi.fn(() => new Promise<never>((resolve) => (answerReceipt = resolve as never))),
    };
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(rpc.getTransactionReceipt).toHaveBeenCalled());
    // The status was missed and the fresh snapshot covering block 12 applied before the receipt came back.
    runtime.resync(12);
    answerReceipt(receipt({ block_number: 12 }));
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED", block: 12 });
  });

  it("promotes a pre-confirmed receipt with no block once a snapshot's re-read finds its block", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = {
      getTransactionReceipt: vi
        .fn()
        .mockResolvedValueOnce(receipt({ block_number: undefined }))
        .mockResolvedValue(receipt({ block_number: 12, finality_status: "ACCEPTED_ON_L2" })),
    };
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running);
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(12);
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED", block: 12 });
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
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync(Number.MAX_SAFE_INTEGER);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    applied({ block: null, hash: TX, status: "PRE_CONFIRMED" });
    await expect(outcome).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it.each(["receipt never answers", "snapshot never arrives"])(
    "releases when %s without restarting the send deadline",
    async (missing) => {
      const startedAt = Date.now();
      await vi.advanceTimersByTimeAsync(12_000);
      const runtime = runtimeWith(new Promise(() => {}));
      const rpc =
        missing === "receipt never answers"
          ? { getTransactionReceipt: vi.fn(() => new Promise<never>(() => {})) }
          : rpcAnswering(receipt());
      const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, running, undefined, undefined, startedAt);
      const ended = expect(outcome).rejects.toThrow("No answer");
      await vi.advanceTimersByTimeAsync(2_000);
      await ended;
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("stays pending while the receipt is not found, and stops when the client does", async () => {
    vi.useFakeTimers();
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = { getTransactionReceipt: vi.fn(async () => Promise.reject(new Error("Transaction hash not found"))) };
    const client = new AbortController();
    const outcome = waitForActionOutcome(runtime, rpc, GAMES, TX, client.signal);
    const ended = expect(outcome).rejects.toThrow("disposed");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(rpc.getTransactionReceipt).not.toHaveBeenCalled();
    client.abort(new Error("Game client disposed"));
    await ended;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
