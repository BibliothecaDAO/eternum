import { byteArray, hash, shortString } from "starknet";
import { describe, expect, it, vi } from "vitest";

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
  let resync = () => {};
  return {
    waitForTransaction: vi.fn(() => status),
    subscribeResynced: vi.fn((listener: () => void) => {
      resync = listener;
      return () => {};
    }),
    resync: () => resync(),
  };
};

describe("an action's outcome", () => {
  it("ends a reverted action with its revert reason, without waiting for Herald", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rpc = rpcAnswering(receipt({ execution_status: "REVERTED", revert_reason: "stale release pin" }));
    await expect(waitForActionOutcome(runtime, rpc, GAMES, TX, running)).resolves.toMatchObject({
      status: "REVERTED",
      revertReason: "stale release pin",
    });
    expect(runtime.waitForTransaction).not.toHaveBeenCalled();
  });

  it("ends an action the game refused with the game's reason: nothing of it applied", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const rejected = {
      from_address: GAMES,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", TX],
      data: [shortString.encodeShortString("GAMEPLAY"), ...byteArrayFields("Not enough stamina to explore")],
    };
    const rpc = rpcAnswering(receipt({ events: [rejected] }));
    await expect(waitForActionOutcome(runtime, rpc, GAMES, TX, running)).resolves.toMatchObject({
      status: "REJECTED",
      revertReason: "Not enough stamina to explore",
    });
    expect(runtime.waitForTransaction).not.toHaveBeenCalled();
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

  it("settles an applied action from the fresh snapshot when a reconnect means Herald never streams its status", async () => {
    const runtime = runtimeWith(new Promise(() => {}));
    const outcome = waitForActionOutcome(runtime, rpcAnswering(receipt()), GAMES, TX, running);
    await vi.waitFor(() => expect(runtime.subscribeResynced).toHaveBeenCalled());
    runtime.resync();
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
