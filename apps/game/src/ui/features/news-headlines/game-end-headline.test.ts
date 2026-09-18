import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";
import { resolveGameEndHeadline } from "./game-end-headline";

function game(store: NativeFactStore, finalTrial = 0, endAt = 100) {
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [
        {
          hashed_keys: "0x1",
          models: {
            GameRegistry: {
              game_id: 1,
              name: 0,
              series_id: 0,
              game_number_in_series: 1,
              preset_id: 2,
              creator: 1,
              settled: false,
              ready: true,
              dev_mode_on: false,
              start_settling_at: 1,
              start_main_at: 2,
              end_at: endAt,
              end_grace_seconds: 10,
              final_trial_id: finalTrial,
              seed: 0,
            },
          },
        },
      ],
    },
  ]);
}
function rank(store: NativeFactStore, gameId: number, player: number, place: number) {
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [
        {
          hashed_keys: String(gameId * 1000 + player),
          models: {
            PlayerRank: { game_id: gameId, player, rank: place, chests: 0, elite: false },
          },
        },
      ],
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
    rank(store, 1, 42, 1);
    expect(headline(store, 100)?.description).toContain("awaiting settlement");
    game(store, 5);
    expect(headline(store, 100)).toMatchObject({ id: "game-end:1:result", description: "Player 42 wins!" });
  });
  it("recovers a finalized result from the snapshot and respects game scope and ties", () => {
    const store = new NativeFactStore();
    game(store, 5);
    rank(store, 2, 99, 1);
    rank(store, 1, 43, 1);
    rank(store, 1, 42, 1);
    rank(store, 1, 44, 3);
    expect(headline(store, 200)?.description).toBe("Player 42 and Player 43 share victory!");
  });
  it("announces the authoritative season winner without requiring a finite end clock", () => {
    const store = new NativeFactStore();
    game(store, 0, 0);
    expect(headline(store, 200)).toBeNull();
    expect(headline(store, 200, 42n)?.description).toBe("Player 42 wins!");
  });
  it("does not announce an end before game state has arrived", () => {
    expect(headline(new NativeFactStore(), 200)).toBeNull();
  });
});
