import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { GameClient } from "@bibliothecadao/eternum";
import type { Account } from "starknet";
import { createHarnessGame } from "./harness-game";
import type { HarnessGameClient } from "./game-client";
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

test("a submitted hash cannot count as applied without the receipt observation port", async () => {
  const provider = new EventEmitter();
  const game = createHarnessGame({
    gameId: 1,
    waitForAction: async () => {
      throw new Error("receipt port unavailable");
    },
    setup: { store: {}, systemCalls: {}, network: { provider } },
  } as unknown as GameClient);
  const submission = await game.submit({ address: "0x1" } as Account, async () => {
    provider.emit("transactionSubmitted", { signerAddress: "0x1", transactionHash: "0x123" });
  });
  await expect(submission.confirmed).rejects.toThrow("receipt port");
});

test("a signer with its own client acts through it, where its submissions are announced", () => {
  const shared = { gameId: 5, setup: { store: {}, systemCalls: {} } } as unknown as GameClient;
  const own = { gameId: 5, setup: { store: {}, systemCalls: {} } } as unknown as GameClient;
  const signer = { address: "0x0abc" } as unknown as Account;
  const actorClients = new Map([["0xabc", { client: own } as unknown as HarnessGameClient]]);
  const game = createHarnessGame(shared, undefined, actorClients);
  expect(game.clientFor(signer)).toBe(own);
  expect(createHarnessGame(shared).clientFor(signer)).toBe(shared);
  expect(() => game.clientFor({ address: "0xdef" } as unknown as Account)).toThrow("has no client of its own");
});

test("a prepared Frontier player reaches confirmed play with no owner credential", async () => {
  const saved = { address: process.env.DEPLOYER_ACCOUNT_ADDRESS, key: process.env.DEPLOYER_PRIVATE_KEY };
  delete process.env.DEPLOYER_ACCOUNT_ADDRESS;
  delete process.env.DEPLOYER_PRIVATE_KEY;
  const signer = { address: "0x42" } as Account;
  const provider = new EventEmitter();
  const calls: unknown[] = [];
  const client = {
    gameId: 7,
    waitForAction: async () => ({ status: "SUCCEEDED" }),
    setup: {
      store: {},
      network: { provider },
      systemCalls: {
        settle_season: async (call: unknown) => {
          calls.push(call);
          provider.emit("transactionSubmitted", { signerAddress: signer.address, transactionHash: "0x123" });
        },
      },
    },
  } as unknown as GameClient;
  try {
    const game = createHarnessGame(client);
    const sent = await game.submit(signer, () => game.settle(signer, signer.address, "Frontier1", "frontier"));
    await sent.confirmed;
    expect(calls).toEqual([{ signer, name: "0x46726f6e7469657231" }]);
    expect(sent.transactionHash).toBe("0x123");
  } finally {
    if (saved.address === undefined) delete process.env.DEPLOYER_ACCOUNT_ADDRESS;
    else process.env.DEPLOYER_ACCOUNT_ADDRESS = saved.address;
    if (saved.key === undefined) delete process.env.DEPLOYER_PRIVATE_KEY;
    else process.env.DEPLOYER_PRIVATE_KEY = saved.key;
  }
});
