import { statusSubscription } from "./test-observations";
import { describe, expect, it, spyOn } from "bun:test";
import type { HarnessProvider } from "./provider";
import { EventEmitter } from "node:events";
import type { GameClient } from "@bibliothecadao/eternum";
import type { Account } from "starknet";
import { createHarnessGame } from "./harness-game";
import { trackTransaction } from "./driver";

const never = new Promise(() => {});
const accepted = {
  subscribeTransactionStatus: async () => statusSubscription({ finality_status: "ACCEPTED_ON_L2" }),
  getTransactionReceipt: async () => ({ block_number: 42 }),
} as unknown as HarnessProvider;

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
  it("includes admission wait and Herald application in visible latency", async () => {
    let clock = 1_000;
    const now = spyOn(Date, "now").mockImplementation(() => clock);
    let applied!: () => void;
    const confirmed = new Promise<void>((resolve) => {
      applied = resolve;
    });
    const provider = {
      subscribeTransactionStatus: async () => {
        clock = 1_500;
        applied();
        return statusSubscription({ finality_status: "ACCEPTED_ON_L2" });
      },
      getTransactionReceipt: async () => ({ block_number: 42 }),
    } as unknown as HarnessProvider;
    try {
      const result = await trackTransaction({
        botId: 1,
        gameId: 1,
        kind: "explore",
        stage: "workload",
        provider,
        send: async () => {
          clock = 1_300;
          return { transactionHash: "0x123", confirmed };
        },
      });
      expect(result.outcome).toBe("completed");
      expect(result.submitMs).toBe(300);
      expect(result.preConfirmedMs).toBe(200);
      expect(result.admissionToVisibleMs).toBe(500);
      expect(result.visibleAt).toBe(new Date(1_500).toISOString());
    } finally {
      now.mockRestore();
    }
  });
  it("bounds a missing Herald update while retaining L2 measurements", async () => {
    const result = await track(never);
    expect(result.outcome).toBe("confirmation_timeout");
    expect(result.acceptedOnL2Block).toBe(42);
    expect(result.error).toContain("Herald");
  });
  it("bounds a stalled receipt request", async () => {
    const result = await track(never, { subscribeTransactionStatus: () => never } as unknown as HarnessProvider);
    expect(result.outcome).toBe("confirmation_timeout");
  });
  it("reports a failed Herald barrier even when the chain accepted the action", async () => {
    const result = await track(Promise.reject(new Error("disconnected")));
    expect(result.outcome).toBe("driver_failed");
    expect(result.error).toContain("disconnected");
  });
  it("accepts setup sends without a Herald barrier and completed action barriers", async () => {
    const setup = await track(undefined);
    expect(setup.outcome).toBe("completed");
    expect(setup.admissionToVisibleMs).toBeUndefined();
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
          return barrier.then(() => ({
            status: "ACCEPTED_ON_L2",
            executions: [{ gameId: "1", actor: "0xabc", nonce: "0", order: "1", status: "SUCCEEDED", reason: "" }],
          }));
        },
      },
    } as unknown as GameClient;
    const game = createHarnessGame(client);
    const submission = await game.submit({ address: "0xabc" } as Account, async () => {
      provider.emit("transactionSubmitted", {
        signerAddress: "0xabc",
        transactionHash: "0x123",
        ticket: { gameId: "1", actor: "0xabc", nonce: "0", order: "1" },
      });
      return { statusReceipt: "PENDING", transaction_hash: "0x123" };
    });
    expect(hashes).toEqual(["0x123"]);
    let completed = false;
    void submission.confirmed!.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    applied();
    await submission.confirmed;
  });
});
