import { expect, it } from "vitest";

import { sharePointCutoff, unclaimedSharePoints } from "./shareholder-points";

// Vectors from contracts/l3/world-native/src/tests/hyperstructures.cairo: 1,000 points per second, a hyperstructure
// completed at t=50, a game ending at t=200.
const game = { dev_mode_on: false, end_at: 200n };
const actor = 0x123n;
const other = 987n;

it("earns what the contract's checkpoint registers, split per share and stopped at the game end", () => {
  const whole = { start_at: 50n, multiplier: 1, shareholders: [{ player: actor, bps: 10_000 }] };
  expect(unclaimedSharePoints(whole, 1_000, sharePointCutoff(game, 100n))).toEqual([
    { player: actor, points: 50_000n },
  ]);

  const split = {
    start_at: 100n,
    multiplier: 1,
    shareholders: [
      { player: actor, bps: 2_500 },
      { player: other, bps: 7_500 },
    ],
  };
  expect(unclaimedSharePoints(split, 1_000, sharePointCutoff(game, 500n))).toEqual([
    { player: actor, points: 25_000n },
    { player: other, points: 75_000n },
  ]);

  const duel = { start_at: 50n, multiplier: 2, shareholders: [{ player: actor, bps: 10_000 }] };
  expect(unclaimedSharePoints(duel, 1_000, 60n)).toEqual([{ player: actor, points: 20_000n }]);
  expect(unclaimedSharePoints(split, 1_000, 100n)).toEqual([]);
});
