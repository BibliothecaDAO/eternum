import { expect, it, vi } from "vitest";

// The build's ledger (contracts/common/addresses for its L2): a paid entry is honoured only on it.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0xa",
}));

import type { DirectoryGame } from "../herald";
import { claimSeasonCall } from "../value/ledger";
import { placeShares, type SeasonPrize, seasonSourceOf, seasonState } from "./blitz-season";

const WEI = 10n ** 18n;

it("claims a season's share with one call", () => {
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
    wallet: "0x4a1",
    share: 5n * WEI,
    claimed: false,
    strk: WEI,
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
  expect(seasonState(prize({}, { strk: 0n }), 250)).toBe("no-strk");
  expect(seasonState(prize({}, { claimed: true }), 250)).toBe("claimed");
  expect(seasonState(prize({}, { share: null }), 250)).toBe("out");
});

const game = (id: number, start: number, entry: object = { kind: "free" }) =>
  ({ chainId: "0x52", game_id: id, mode: "blitz", clock: { start_main_at: start }, entry }) as unknown as DirectoryGame;
const paid = (id: number) => ({
  kind: "paid",
  ledger: { address: "0xa", chainId: "0x534e5f4d41494e", shard: "0x52", gameId: id },
});

it("takes the season from the player's own newest paid Blitz game, never from games still to come", () => {
  expect(seasonSourceOf([game(1, 10)])).toBeNull();
  expect(seasonSourceOf([game(1, 10, paid(1)), game(2, 20, paid(2)), game(3, 30)])).toEqual({
    kind: "paid",
    ledger: expect.objectContaining({ gameId: 2 }),
  });
});

it("refuses the season when the player's newest paid entry is broken, instead of skipping to an older one", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(seasonSourceOf([game(1, 10, paid(1)), game(2, 20, { kind: "paid" })])).toEqual({ kind: "broken" });
});
