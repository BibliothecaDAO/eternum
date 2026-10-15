import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";
import { resolveGameEndHeadline } from "./game-end-headline";

function game(store: NativeFactStore, endAt = 100) {
  store.applyFacts([
    {
      model: "GameRegistry",
      key: "0x1",
      value: {
        game_id: 1,
        name: 0,
        preset_id: 2,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: 1,
        start_main_at: 2,
        end_at: endAt,
        end_grace_seconds: 10,
        seed: 0,
      },
    },
  ]);
}
/** The result ranks wallets; the roster reads each back to its account, here the wallet plus 1000. */
function result(store: NativeFactStore, gameId: number, players: { player: number; rank: number }[], complete = true) {
  store.applyFacts([
    {
      model: "BlitzResult",
      key: String(100 + gameId),
      value: {
        game_id: gameId,
        players: players.map(({ player, rank }) => ({ wallet: 1000 + player, rank })),
        complete,
        commitment: complete ? 123 : 0,
      },
    },
    {
      model: "BlitzRoster",
      key: String(200 + gameId),
      value: { game_id: gameId, players: players.map(({ player }) => ({ account: player, wallet: 1000 + player })) },
    },
  ]);
}
const name = (address: bigint) => `Player ${address}`;
const headline = (store: NativeFactStore, winner: bigint | null = null) =>
  resolveGameEndHeadline(store, 1, winner, name);
/** Every ranked account's registered points: a final result is read only once each of them is known. */
function points(store: NativeFactStore, gameId: number, accounts: number[]) {
  store.applyFacts(
    accounts.map((account) => ({
      model: "PlayerPoints",
      key: String(300 + gameId * 1000 + account),
      value: { game_id: gameId, address: account, points: 1 },
    })),
  );
}

describe("game end headlines", () => {
  it("says nothing when the clock runs out: the end is announced once, from the result", () => {
    const store = new NativeFactStore();
    game(store);
    expect(headline(store)).toBeNull();
    result(store, 1, [{ player: 42, rank: 1 }], false);
    expect(headline(store)).toBeNull();
    result(store, 1, [{ player: 42, rank: 1 }]);
    expect(headline(store)).toBeNull();
    points(store, 1, [42]);
    expect(headline(store)).toMatchObject({ id: "game-end:1", description: "Player 42 wins!" });
  });
  it("recovers a finalized result from the snapshot and respects game scope and ties", () => {
    const store = new NativeFactStore();
    game(store);
    result(store, 2, [{ player: 99, rank: 1 }]);
    points(store, 2, [99]);
    result(store, 1, [
      { player: 43, rank: 1 },
      { player: 42, rank: 1 },
      { player: 44, rank: 3 },
    ]);
    points(store, 1, [42, 43, 44]);
    expect(headline(store)?.description).toBe("Player 42 and Player 43 share victory!");
  });
  it("announces the authoritative season winner without requiring a finite end clock", () => {
    const store = new NativeFactStore();
    game(store, 0);
    expect(headline(store)).toBeNull();
    expect(headline(store, 42n)?.description).toBe("Player 42 wins!");
  });
  it("names no winner from a broken result: it is reported, never thrown into the headline bridge", () => {
    const store = new NativeFactStore();
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    game(store);
    store.applyFacts([
      {
        model: "BlitzResult",
        key: "0x101",
        value: { game_id: 1, players: [{ wallet: 1042, rank: 1 }], complete: true, commitment: 123 },
      },
      { model: "BlitzRoster", key: "0x201", value: { game_id: 1, players: [{ account: 7, wallet: 1007 }] } },
    ]);
    expect(headline(store)).toBeNull();
    expect(String(reported.mock.calls[0])).toContain("outside game 1's roster");
    reported.mockRestore();
  });
  it("does not announce an end before game state has arrived", () => {
    expect(headline(new NativeFactStore())).toBeNull();
  });
});
