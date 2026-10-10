import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";

import { readFinalBlitzResult, resolveFinalizedBlitzStanding } from "./finalized-blitz-leaderboard";

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

  it("marks players outside the finalized roster as unranked when finalized standings are active", () => {
    expect(resolveFinalizedBlitzStanding(null, true)).toEqual({
      rankOverride: Number.MAX_SAFE_INTEGER,
      pointsOverride: 0,
      includesLiveShareholderPoints: false,
    });
  });

  it("returns finalized rank and points overrides when a standing exists", () => {
    expect(resolveFinalizedBlitzStanding({ rank: 3, points: 44 }, true)).toEqual({
      rankOverride: 3,
      pointsOverride: 44,
      includesLiveShareholderPoints: false,
    });
  });
});
