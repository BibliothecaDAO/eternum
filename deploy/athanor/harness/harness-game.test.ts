import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { GameClient } from "@bibliothecadao/eternum/game-client";
import type { Account } from "starknet";
import { createHarnessGame } from "./harness-game";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";

test("setup waits for the confirmed start and roster readiness in every game mode", async () => {
  let timestamp = 82;
  let start = 100n;
  let ready = false;
  setBlockTimestampSource(() => timestamp);
  const game = createHarnessGame({
    gameId: 4,
    setup: {
      store: {
        require: () => ({ start_main_at: start, start_settling_at: 40n, end_at: 200n, ready, dev_mode_on: false }),
      },
      systemCalls: {},
    },
  } as unknown as GameClient);
  let started = false;
  const waiting = game.waitUntilPlaying().then(() => {
    started = true;
  });
  try {
    await Bun.sleep(10);
    expect(started).toBe(false);
    timestamp = 100;
    await Bun.sleep(1_050);
    expect(started).toBe(false);
    ready = true;
    start = 110n;
    await Bun.sleep(1_050);
    expect(started).toBe(false);
    timestamp = 110;
    await waiting;
    expect(started).toBe(true);
    timestamp = 200;
    await expect(game.waitUntilPlaying()).rejects.toThrow("Game 4 has ended");
  } finally {
    setBlockTimestampSource(null);
  }
});

test("a mixed transaction completes only the successful bot's own ticket", async () => {
  const provider = new EventEmitter();
  const successful = { gameId: "1", actor: "1", nonce: "2", order: "3", status: "SUCCEEDED", reason: "" };
  const rejected = { gameId: "1", actor: "2", nonce: "2", order: "4", status: "REVERTED", reason: "GAMEPLAY_REJECTED" };
  const game = createHarnessGame({
    gameId: 1,
    setup: { store: {}, systemCalls: {}, network: { provider } },
    runtime: { waitForTransaction: async () => ({ status: "ACCEPTED_ON_L2", executions: [rejected, successful] }) },
  } as unknown as GameClient);
  for (const ticket of [successful, rejected]) {
    const submission = await game.submit({ address: ticket.actor } as Account, async () => {
      provider.emit("transactionSubmitted", { signerAddress: ticket.actor, transactionHash: "0x123", ticket });
    });
    if (ticket === rejected) await expect(submission.confirmed).rejects.toThrow("GAMEPLAY_REJECTED");
    else await expect(submission.confirmed).resolves.toBeUndefined();
  }
});

test("a native hash without ticket identity cannot count as a completed action", async () => {
  const provider = new EventEmitter();
  const game = createHarnessGame({
    gameId: 1,
    setup: { store: {}, systemCalls: {}, network: { provider } },
  } as unknown as GameClient);
  await expect(
    game.submit({ address: "0x1" } as Account, async () => {
      provider.emit("transactionSubmitted", { signerAddress: "0x1", transactionHash: "0x123" });
    }),
  ).rejects.toThrow("no ticket identity");
});
