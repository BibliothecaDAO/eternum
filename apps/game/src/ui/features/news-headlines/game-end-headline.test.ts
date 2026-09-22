import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";
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
        creator: 1,
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
function result(store: NativeFactStore, gameId: number, players: { player: number; rank: number }[], complete = true) {
  store.applyFacts([
    {
      model: "BlitzResult",
      key: String(100 + gameId),
      value: {
        game_id: gameId,
        players: players.map((player) => ({ ...player, points: 0 })),
        complete,
        commitment: complete ? 123 : 0,
      },
    },
  ]);
}
const name = (address: bigint) => `Player ${address}`;
const headline = (store: NativeFactStore, now: number, winner: bigint | null = null) =>
  resolveGameEndHeadline(store, 1, now, winner, name);

describe("game end headlines", () => {
  it("announces clock expiry even before the final ranking arrives", () => {
    const store = new NativeFactStore();
    game(store);
    expect(headline(store, 99)).toBeNull();
    expect(headline(store, 100)).toMatchObject({
      title: "THE GAME HAS ENDED",
      description: "The final result is awaiting settlement.",
    });
    expect(headline(store, 101)?.id).toBe(headline(store, 100)?.id);
  });
  it("waits for finalization instead of naming a provisional leader, then announces the winner", () => {
    const store = new NativeFactStore();
    game(store);
    result(store, 1, [{ player: 42, rank: 1 }], false);
    expect(headline(store, 100)?.description).toContain("awaiting settlement");
    result(store, 1, [{ player: 42, rank: 1 }]);
    expect(headline(store, 100)).toMatchObject({ id: "game-end:1:result", description: "Player 42 wins!" });
  });
  it("recovers a finalized result from the snapshot and respects game scope and ties", () => {
    const store = new NativeFactStore();
    game(store);
    result(store, 2, [{ player: 99, rank: 1 }]);
    result(store, 1, [
      { player: 43, rank: 1 },
      { player: 42, rank: 1 },
      { player: 44, rank: 3 },
    ]);
    expect(headline(store, 200)?.description).toBe("Player 42 and Player 43 share victory!");
  });
  it("announces the authoritative season winner without requiring a finite end clock", () => {
    const store = new NativeFactStore();
    game(store, 0);
    expect(headline(store, 200)).toBeNull();
    expect(headline(store, 200, 42n)?.description).toBe("Player 42 wins!");
  });
  it("does not announce an end before game state has arrived", () => {
    expect(headline(new NativeFactStore(), 200)).toBeNull();
  });
});
