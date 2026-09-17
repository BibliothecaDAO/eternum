import { describe, expect, it } from "bun:test";
import type { RpcProvider } from "starknet";
import { EventEmitter } from "node:events";
import type { GameClient } from "@bibliothecadao/eternum";
import type { Account } from "starknet";
import { createHarnessGame } from "./harness-game";
import { trackTransaction } from "./driver";

const never = new Promise(() => {});
const accepted = {
  getTransactionStatus: async () => ({ finality_status: "ACCEPTED_ON_L2" }),
  getTransactionReceipt: async () => ({ block_number: 42 }),
} as unknown as RpcProvider;

const track = (confirmed: Promise<unknown> | undefined, provider = accepted) =>
  trackTransaction({
    botId: 1,
    gameId: 1,
    kind: "explore",
    stage: "workload",
    provider,
    confirmationTimeoutMs: 20,
    send: async () => ({ transactionHash: "0x123", confirmed }),
  });

describe("transaction confirmation deadline", () => {
  it("bounds a missing Herald update while retaining L2 measurements", async () => {
    const result = await track(never);
    expect(result.outcome).toBe("confirmation_timeout");
    expect(result.acceptedOnL2Block).toBe(42);
    expect(result.error).toContain("Herald");
  });
  it("bounds a stalled receipt request", async () => {
    const result = await track(never, { getTransactionStatus: () => never } as unknown as RpcProvider);
    expect(result.outcome).toBe("confirmation_timeout");
  });
  it("reports a failed Herald barrier even when the chain accepted the action", async () => {
    const result = await track(Promise.reject(new Error("disconnected")));
    expect(result.outcome).toBe("driver_failed");
    expect(result.error).toContain("disconnected");
  });
  it("accepts setup sends without a Herald barrier and completed action barriers", async () => {
    expect((await track(undefined)).outcome).toBe("completed");
    expect((await track(Promise.resolve())).outcome).toBe("completed");
  });
});

describe("shared client submission barrier", () => {
  it("does not confuse a queued action's pending response with applied Herald state", async () => {
    const provider = new EventEmitter();
    let applied!: () => void;
    const barrier = new Promise<void>((resolve) => {
      applied = resolve;
    });
    const hashes: string[] = [];
    const client = {
      gameId: 1,
      setup: { store: {}, systemCalls: {}, network: { provider } },
      runtime: {
        waitForTransaction: (hash: string) => {
          hashes.push(hash);
          return barrier;
        },
      },
    } as unknown as GameClient;
    const game = createHarnessGame(client);
    const submission = await game.submit({ address: "0xabc" } as Account, async () => {
      provider.emit("transactionSubmitted", { signerAddress: "0xabc", transactionHash: "0x123" });
      return { statusReceipt: "PENDING", transaction_hash: "0x123" };
    });
    expect(hashes).toEqual(["0x123"]);
    expect(submission.confirmed).toBe(barrier);
    applied();
    await submission.confirmed;
  });
});
