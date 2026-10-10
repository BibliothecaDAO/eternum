import { expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { claimSeasonCall } from "../value/ledger";
import { placeShares, type SeasonPrize, seasonSourceOf, seasonState } from "./blitz-season";

const WEI = 10n ** 18n;

it("claims a season's share with one call naming its place on the posted list", () => {
  expect(claimSeasonCall("0xledger", 3, 11)).toEqual({
    contractAddress: "0xledger",
    entrypoint: "claim_season",
    calldata: ["3", "11"],
  });
});

it("splits the pool by the ledger's rule: ceil(paid fraction) places, decaying weights, the remainder last", () => {
  const shares = placeShares(1_000n, 25, { paidFractionBps: 1000, decayBps: 5000 });
  // ceil(25 × 10%) = 3 places weighing 4 : 2 : 1 of 7.
  expect(shares).toEqual([571n, 285n, 144n]);
  expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(1_000n);
  expect(placeShares(1_000n, 0, { paidFractionBps: 1000, decayBps: 9600 })).toEqual([]);
});

it("runs, closes, reviews, holds, then claims, waits on the fee, is claimed, or pays nothing", () => {
  const prize = (overrides: Partial<SeasonPrize["season"]>, rest: Partial<SeasonPrize> = {}): SeasonPrize => ({
    ledger: "0xl",
    seasonId: 3,
    season: {
      participants: 500,
      winners: 50,
      posted: true,
      challenged: false,
      reviewUntil: 200,
      presetId: 4,
      start: 0,
      end: 100,
      pool: WEI,
      ...overrides,
    },
    curve: { paidFractionBps: 1000, decayBps: 9600 },
    wallet: "0x4a1",
    share: 5n * WEI,
    position: 4,
    claimed: false,
    ...rest,
  });
  expect(seasonState(prize({ posted: false }), 50)).toBe("running");
  expect(seasonState(prize({ posted: false }), 150)).toBe("closing");
  expect(seasonState(prize({}), 150)).toBe("review");
  expect(seasonState(prize({ challenged: true }), 250)).toBe("held");
  // ceil(500 × 10%) = 50 paid places: a list of 49 is refused by the ledger, so nobody is offered Claim.
  expect(seasonState(prize({ winners: 49 }), 250)).toBe("held");
  expect(seasonState(prize({ winners: 49 }), 150)).toBe("held");
  expect(seasonState(prize({}), 250)).toBe("claim");
  expect(seasonState(prize({}, { claimed: true }), 250)).toBe("claimed");
  expect(seasonState(prize({}, { share: null, position: null }), 250)).toBe("out");
});

/** A Blitz game in the player's history, filled from a slot (or none), the player on its roster with a wallet (or not). */
const game = (id: number, start: number, slotId: number | null, wallet: string | null) =>
  ({
    chainId: "0x52",
    game_id: id,
    mode: "blitz",
    clock: { start_main_at: start },
    slotId,
    player_state: { registered: true, settled: true, roster_wallet: wallet, structures: [] },
  }) as unknown as DirectoryGame;

it("takes the season from the player's own newest paid Blitz game, for the wallet the roster froze for their seat", () => {
  expect(seasonSourceOf([game(1, 10, null, "0xa11")])).toBeNull();
  expect(seasonSourceOf([game(1, 10, 1, "0xa11"), game(2, 20, 2, "0xb22"), game(3, 30, null, "0xc33")])).toEqual({
    slot: { shard: "0x52", slotId: 2 },
    wallet: "0xb22",
  });
  // A game the player held no seat in has no share of theirs.
  expect(seasonSourceOf([game(1, 10, 1, "0xa11"), game(2, 20, 2, null)])).toEqual({
    slot: { shard: "0x52", slotId: 1 },
    wallet: "0xa11",
  });
});
