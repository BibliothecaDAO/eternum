import { expect, test } from "bun:test";
import { playersOf, validatePreparedRoster } from "./run";

function roster() {
  return Array.from({ length: 4 }, (_, game) => ({
    game: { gameId: game + 1, gameName: `test-${game + 1}`, settlementTransactions: 0 },
    accounts: Array.from({ length: 24 }, (_, index) => ({
      address: String(game * 24 + index + 1),
      botId: game * 24 + index,
      gameId: game + 1,
    })),
  }));
}

test("96 Blitz bots have one approved player account and one worker each across four legal rosters", () => {
  const games = roster();
  validatePreparedRoster(games as never, 96);
  const players = playersOf("build-order", games as never);
  expect(players.kind).toBe("roster");
  if (players.kind !== "roster") throw new Error("Missing player workers");
  expect(players.groups).toHaveLength(96);
  expect(players.groups.every((group) => group.accounts.length === 1)).toBe(true);
  expect(new Set(players.groups.map((group) => group.accounts[0]!.address)).size).toBe(96);
  expect(new Set(players.groups.map((group) => group.game.gameId)).size).toBe(4);
});
test("duplicate fixture accounts cannot enter two independently serialized workers", () => {
  const games = roster();
  games[1]!.accounts[0]!.address = "0x1";
  expect(() => validatePreparedRoster(games as never, 96)).toThrow("repeats a player account");
});
test("missing participants and wrong-game accounts fail before starting any worker", () => {
  const games = roster();
  expect(() => validatePreparedRoster(games as never, 97)).toThrow("bot count");
  games[1]!.accounts[0]!.gameId = 1;
  expect(() => validatePreparedRoster(games as never, 96)).toThrow("another game");
});
test("one Frontier season carries all 96 bots across six workers", () => {
  const groups = roster();
  const prepared = {
    game: groups[0]!.game,
    accounts: groups.flatMap((group) => group.accounts.map((account) => ({ ...account, gameId: 1 }))),
  };
  validatePreparedRoster(prepared as never, 96);
  const players = playersOf("frontier", prepared as never, 6);
  expect(players.kind).toBe("roster");
  if (players.kind !== "roster") throw new Error("Missing season workers");
  expect(players.groups).toHaveLength(6);
  expect(players.groups.every((group) => group.game.gameId === 1 && group.accounts.length === 16)).toBe(true);
});
