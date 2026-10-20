import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";

import { readFinalBlitzResult } from "./finalized-blitz-leaderboard";

const GAME = 1;

const finalResult = (store: NativeFactStore, players: { wallet: bigint; rank: number }[]) =>
  store.applyFacts([
    { model: "BlitzResult", key: "0x1", value: { game_id: GAME, players, complete: true, commitment: 1 } },
  ]);
const roster = (store: NativeFactStore, players: { account: bigint; wallet: bigint }[]) =>
  store.applyFacts([{ model: "BlitzRoster", key: "0x2", value: { game_id: GAME, players } }]);
const registeredPoints = (store: NativeFactStore, address: bigint, points: bigint) =>
  store.applyFacts([
    { model: "PlayerPoints", key: `0x${(0x100n + address).toString(16)}`, value: { game_id: GAME, address, points } },
  ]);

describe("finalized blitz leaderboard helpers", () => {
  it("ranks the result's wallets as the accounts that played them, scored by their registered points", () => {
    const store = new NativeFactStore();
    finalResult(store, [
      { wallet: 0xb2n, rank: 2 },
      { wallet: 0xb1n, rank: 1 },
    ]);
    roster(store, [
      { account: 0xa1n, wallet: 0xb1n },
      { account: 0xa2n, wallet: 0xb2n },
    ]);
    registeredPoints(store, 0xa1n, 12_500_000n);
    registeredPoints(store, 0xa2n, 9_000_000n);

    expect(readFinalBlitzResult(store, GAME)).toEqual({
      status: "final",
      standings: [
        { account: 0xa1n, rank: 1, points: 12_500_000n },
        { account: 0xa2n, rank: 2, points: 9_000_000n },
      ],
    });
  });

  it("waits, explicitly, while the result, its roster or a ranked player's points are unknown", () => {
    const store = new NativeFactStore();
    expect(readFinalBlitzResult(store, GAME)).toEqual({ status: "waiting" });
    finalResult(store, [{ wallet: 0xb1n, rank: 1 }]);
    expect(readFinalBlitzResult(store, GAME)).toEqual({ status: "waiting" });
    roster(store, [{ account: 0xa1n, wallet: 0xb1n }]);
    expect(readFinalBlitzResult(store, GAME)).toEqual({ status: "waiting" });
    registeredPoints(store, 0xa1n, 1n);
    expect(readFinalBlitzResult(store, GAME)).toMatchObject({ status: "final" });
  });

  it("ranks a finished game from its final state once the store vouches for it: who never scored counts 0", () => {
    // Game 9 (dev, 19 Oct) as Herald's review snapshot holds it: djizus first on 335 points, two players tied second
    // who never scored, so they have no points row at all.
    const [djizus, clientlane, uxplay] = [
      0x52c9ab2a4a55934b66b8b0432fd124f8d82645effc94afb5df06759b0dd8c7fn,
      0x29556aae044f8335a3fd433e1566c9ca4bd0e0c14e387dd9d8ca6d4c1114ef3n,
      0x585a494b860f9cb10509b0e34dad2e3d28ad30a54a12026d899cfa4f9ce0292n,
    ];
    const store = new NativeFactStore();
    store.applyFacts([
      {
        model: "BlitzResult",
        key: "0x9",
        value: {
          game_id: "0x9",
          players: [djizus, clientlane, uxplay].map((wallet, index) => ({ rank: index === 0 ? "0x1" : "0x2", wallet })),
          complete: true,
          commitment: "0x1",
        },
      },
      {
        model: "BlitzRoster",
        key: "0x9",
        value: { game_id: "0x9", players: [djizus, clientlane, uxplay].map((wallet) => ({ wallet, account: wallet })) },
      },
      { model: "PlayerPoints", key: "0x99", value: { game_id: "0x9", address: djizus, points: "0x13f7b1c0" } },
    ] as never);
    // The stream's end shut the store's gate: an absent points row is unknown, so the result waits.
    store.setSnapshot({ gameId: 9, complete: false, actor: undefined, timestamp: undefined });
    expect(readFinalBlitzResult(store, 9)).toEqual({ status: "waiting" });
    // The final state opened it again.
    store.setSnapshot({ gameId: 9, complete: true, actor: null, timestamp: undefined });
    expect(readFinalBlitzResult(store, 9)).toEqual({
      status: "final",
      standings: [
        { account: djizus, rank: 1, points: 335_000_000n },
        { account: clientlane, rank: 2, points: 0n },
        { account: uxplay, rank: 2, points: 0n },
      ],
    });
  });

  it("reads a ranked wallet the known roster does not hold as unavailable, and reports it once", () => {
    const store = new NativeFactStore();
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    finalResult(store, [{ wallet: 0xb1n, rank: 1 }]);
    roster(store, [{ account: 0xa2n, wallet: 0xb2n }]);

    expect(readFinalBlitzResult(store, GAME)).toEqual({ status: "unavailable" });
    expect(readFinalBlitzResult(store, GAME)).toEqual({ status: "unavailable" });
    expect(reported).toHaveBeenCalledOnce();
    expect(String(reported.mock.calls[0])).toContain("outside game 1's roster");
    reported.mockRestore();
  });
});
