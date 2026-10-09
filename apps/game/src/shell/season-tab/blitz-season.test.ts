import { expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { claimSeasonCall, decodeSeason } from "../value/ledger";
import { placeShares, type SeasonPrize, seasonSourceOf, seasonState } from "./blitz-season";

const WEI = 10n ** 18n;

it("reads a season in the interface's order, and claims with one call", () => {
  // chest reserve (2), participants, top count, posted, challenged, review until, settlement started, paid (2),
  // exists, preset, start, end, pool (2).
  expect(
    decodeSeason([
      "0",
      "0",
      "500",
      "50",
      "1",
      "0",
      "7200",
      "0",
      "0",
      "0",
      "1",
      "4",
      "100",
      "3600",
      String(9n * WEI),
      "0",
    ]),
  ).toEqual({
    participants: 500,
    winners: 50,
    posted: true,
    challenged: false,
    reviewUntil: 7200,
    presetId: 4,
    start: 100,
    end: 3600,
    pool: 9n * WEI,
  });
  expect(claimSeasonCall("0xledger", 3)).toEqual({
    contractAddress: "0xledger",
    entrypoint: "claim_season",
    calldata: ["3"],
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
    share: 5n * WEI,
    claimed: false,
    strk: WEI,
    ...rest,
  });
  expect(seasonState(prize({ posted: false }), 50)).toBe("running");
  expect(seasonState(prize({ posted: false }), 150)).toBe("closing");
  expect(seasonState(prize({}), 150)).toBe("review");
  expect(seasonState(prize({ challenged: true }), 250)).toBe("held");
  expect(seasonState(prize({}), 250)).toBe("claim");
  expect(seasonState(prize({}, { strk: 0n }), 250)).toBe("no-strk");
  expect(seasonState(prize({}, { claimed: true }), 250)).toBe("claimed");
  expect(seasonState(prize({}, { share: null }), 250)).toBe("out");
});

it("takes the season from the newest Blitz game that names a ledger", () => {
  const game = (id: number, start: number, ledger?: object) =>
    ({
      chainId: "0x52",
      game_id: id,
      mode: "blitz",
      clock: { start_main_at: start },
      ledger,
    }) as unknown as DirectoryGame;
  expect(seasonSourceOf([game(1, 10)])).toBeNull();
  expect(
    seasonSourceOf([
      game(1, 10, { address: "0xa", chest: "0xc" }),
      game(2, 20, { address: "0xb", chest: "0xc" }),
      game(3, 30),
    ])?.address,
  ).toBe("0xb");
});
