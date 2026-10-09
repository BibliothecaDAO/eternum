import { expect, it } from "vitest";
import type { FoldRow } from "../types";
import { buildNativeLeaderboard } from "./read-models";

function standings(players: { wallet: string; rank: number }[]) {
  const facts: Record<string, Record<string, unknown>[]> = {
    GameRegistry: [{}],
    SliceRules: [{}],
    PlayerEntry: [{ player: "0x111" }, { player: "0x222" }],
    PlayerPoints: [{ address: "0x111", points: "9500000" }],
    BlitzRoster: [
      {
        players: [
          { account: "0x111", wallet: "0x999" },
          { account: "0x222", wallet: "0x888" },
        ],
      },
    ],
    BlitzResult: [{ players, complete: true, commitment: "123" }],
  };
  const rows = (model: string): FoldRow[] =>
    (facts[model] ?? []).map((value, index) => ({ key: String(index), value: { game_id: "1", ...value } }));
  return buildNativeLeaderboard(rows, "1", 500, null);
}

it("maps frozen L2 wallets to shard accounts and reads final points from native facts", () => {
  expect(
    standings([
      { wallet: "0x999", rank: 1 },
      { wallet: "0x888", rank: 2 },
    ]).entries,
  ).toMatchObject([
    { address: "0x111", totalPoints: 9.5, rank: 1 },
    { address: "0x222", totalPoints: 0, rank: 2 },
  ]);
});

it("refuses a completed result whose payout wallet is outside the frozen roster", () => {
  expect(() => standings([{ wallet: "0x777", rank: 1 }])).toThrow("outside the roster");
});
