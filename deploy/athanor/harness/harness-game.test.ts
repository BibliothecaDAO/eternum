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

test("a mixed transaction completes only the successful bot's own ticket", async () => {
  const provider = new EventEmitter();
  const successful = { gameId: "1", actor: "1", nonce: "2", order: "3", status: "SUCCEEDED", statusClass: "", reason: "" };
  const rejected = { gameId: "1", actor: "2", nonce: "2", order: "4", status: "REVERTED", statusClass: "GAMEPLAY_REJECTED", reason: "not enough stamina" };
  const game = createHarnessGame({
    gameId: 1,
    setup: { store: {}, systemCalls: {}, network: { provider } },
    runtime: { waitForTransaction: async () => ({ status: "ACCEPTED_ON_L2", executions: [rejected, successful] }) },
  } as unknown as GameClient);
  for (const ticket of [successful, rejected]) {
    const submission = await game.submit({ address: ticket.actor } as Account, async () => {
      provider.emit("transactionSubmitted", { signerAddress: ticket.actor, transactionHash: "0x123", ticket });
    });
    if (ticket === rejected) await expect(submission.confirmed).rejects.toThrow("GAMEPLAY_REJECTED: not enough stamina");
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

/** A client whose Herald subscription carries only its own actor's outcomes, as Herald's per-actor scope does. */
const scopedClient = (actor: string, batch: Array<{ actor: string }>) => {
  const provider = new EventEmitter();
  return {
    gameId: 1,
    setup: {
      store: {},
      network: { provider },
      systemCalls: {
        settle_season: async ({ signer }: { signer: Account }) =>
          provider.emit("transactionSubmitted", {
            signerAddress: signer.address,
            transactionHash: "0x77",
            ticket: batch.find((outcome) => BigInt(outcome.actor) === BigInt(signer.address)),
          }),
      },
    },
    runtime: {
      waitForTransaction: async () => ({
        status: "ACCEPTED_ON_L2",
        executions: batch.filter((outcome) => BigInt(outcome.actor) === BigInt(actor)),
      }),
    },
  } as unknown as GameClient;
};

test("bots settling at once each get their outcome through their own subscription", async () => {
  // One batch records both foundings, as the gateway packs concurrent tickets.
  const batch = ["0xa", "0xb"].map((actor, index) => ({
    gameId: "1", actor, nonce: "0", order: String(index + 1), status: "SUCCEEDED", statusClass: "", reason: "",
  }));
  const actorClients = new Map(
    ["0xa", "0xb"].map((actor) => [actor, { client: scopedClient(actor, batch) } as HarnessGameClient]),
  );
  const game = createHarnessGame(scopedClient("0xa", batch), undefined, actorClients);
  const settle = (address: string) =>
    game.submit({ address } as Account, () => game.settle({ address } as Account, address, "Frontier", "frontier"));

  const submissions = await Promise.all([settle("0xa"), settle("0xb")]);
  for (const submission of submissions) await expect(submission.confirmed).resolves.toBeUndefined();

  // Through one shared client, whose subscription follows one actor, the other bot's outcome never arrives.
  const shared = createHarnessGame(scopedClient("0xa", batch));
  const lone = await shared.submit({ address: "0xb" } as Account, () =>
    shared.settle({ address: "0xb" } as Account, "0xb", "Frontier", "frontier"),
  );
  await expect(lone.confirmed).rejects.toThrow("Missing or ambiguous native ticket outcome");
});

test("a submission carries the provider's admission-to-visible time for its own transaction", async () => {
  const provider = new EventEmitter();
  const ticket = { gameId: "1", actor: "0x1", nonce: "0", order: "1", status: "SUCCEEDED", statusClass: "", reason: "" };
  const game = createHarnessGame({
    gameId: 1,
    setup: { store: {}, systemCalls: {}, network: { provider } },
    runtime: { waitForTransaction: async () => ({ status: "ACCEPTED_ON_L2", executions: [ticket] }) },
  } as unknown as GameClient);
  const submission = await game.submit({ address: "0x1" } as Account, async () => {
    provider.emit("transactionSubmitted", { signerAddress: "0x1", transactionHash: "0x123", ticket });
  });
  provider.emit("transactionComplete", { details: { transaction_hash: "0x999" }, admissionToVisibleMs: 7 });
  provider.emit("transactionComplete", { details: { transaction_hash: "0x0123" }, admissionToVisibleMs: 42 });
  await expect(submission.admissionToVisibleMs).resolves.toBe(42);
});
