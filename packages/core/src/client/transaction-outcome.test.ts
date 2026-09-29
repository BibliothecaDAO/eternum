import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import type { GameSyncTransaction } from "../sync/game-sync-types";
import { NativeFactStore } from "./native-fact-store";
import { ActionOutcomeUnreportedError, waitForTransactionOutcome } from "./transaction-outcome";

const ticket = { gameId: "1", actor: "0x111", nonce: "2", order: "7" };

const fixture = (nextNonce: number) => {
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "ActionNonce",
      key: hash.computePoseidonHashOnElements([1n, 0x111n]),
      value: { game_id: 1, actor: "0x111", next_nonce: String(nextNonce) },
    },
  ]);
  const resyncListeners = new Set<() => void>();
  let report!: (transaction: GameSyncTransaction) => void;
  const runtime = {
    waitForTransaction: () =>
      new Promise<GameSyncTransaction>((resolve) => {
        report = resolve;
      }),
    subscribeResynced: (listener: () => void) => {
      resyncListeners.add(listener);
      return () => resyncListeners.delete(listener);
    },
  };
  const resync = () => resyncListeners.forEach((listener) => listener());
  return { store, runtime, resync, report: (transaction: GameSyncTransaction) => report(transaction), resyncListeners };
};

describe("waitForTransactionOutcome", () => {
  it("fails an action a reconnect's snapshot shows recorded, since Herald will never stream its status", async () => {
    const { store, runtime, resync, resyncListeners } = fixture(3);
    const outcome = waitForTransactionOutcome(runtime, store, "0xabc", ticket);

    resync();

    await expect(outcome).rejects.toBeInstanceOf(ActionOutcomeUnreportedError);
    expect(resyncListeners.size).toBe(0);
  });

  it("keeps waiting for an action the snapshot does not show recorded, then takes its streamed status", async () => {
    const { store, runtime, resync, report, resyncListeners } = fixture(2);
    const outcome = waitForTransactionOutcome(runtime, store, "0xabc", ticket);

    resync();
    report({ hash: "0xabc", block: 9, status: "ACCEPTED_ON_L2" } as GameSyncTransaction);

    await expect(outcome).resolves.toMatchObject({ hash: "0xabc" });
    expect(resyncListeners.size).toBe(0);
  });
});
