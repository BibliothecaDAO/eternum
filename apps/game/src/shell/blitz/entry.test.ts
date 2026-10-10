import { expect, it } from "vitest";

import { entryCost, entryShares, entryState, type EntryTerms } from "./entry";

const WEI = 10n ** 18n;
const terms = (overrides: Partial<EntryTerms> = {}): EntryTerms => ({
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 2000, chestLordsBps: 500 },
  cancelled: false,
  close: 1_000,
  credits: { swords: 0, shields: 0 },
  registration: {
    registered: false,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 0n,
    refundable: false,
    gameId: 0,
  },
  lordsToken: "0x10e5",
  lords: 2_140n * WEI,
  ...overrides,
});

it("charges the seat and each flag, a held credit paying for its flag", () => {
  expect(entryCost(terms(), { sword: true, shield: true }).cash).toBe(1_500n * WEI);
  const credited = entryCost(terms({ credits: { swords: 2, shields: 0 } }), { sword: true, shield: true });
  expect(credited).toEqual({ cash: 1_000n * WEI, swordCredit: true, shieldCredit: false });
});

it("splits what an entry pays as the ledger settles it: the treasury's cut, then the chests' share, the rest to the pool", () => {
  // 1,000 paid, 20% cut, 5% of the rest to the chests: 200 · 40 · 760.
  expect(entryShares(1_000n * WEI, { protocolCutBps: 2000, chestLordsBps: 500 })).toEqual({
    treasury: 200n * WEI,
    chests: 40n * WEI,
    pool: 760n * WEI,
  });
});

it("tells choosing, short of LORDS, registered, refund and refunded apart", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 900, false)).toBe("choose");
  expect(entryState(terms({ lords: 320n * WEI }), both, 900, false)).toBe("short");
  const seated = {
    registered: true,
    sword: true,
    shield: true,
    swordCredit: true,
    shieldCredit: false,
    paid: 1_000n * WEI,
    refundable: false,
    gameId: 0,
  };
  expect(entryState(terms({ registration: seated }), both, 900, false)).toBe("registered");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 900, false)).toBe("refund");
  const back = { ...seated, swordCredit: false, paid: 0n };
  expect(entryState(terms({ registration: back, cancelled: true }), both, 900, false)).toBe("refunded");
});

it("closes the entry once the slot has closed; a registration is seated once a game's roster names its wallet", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 999, false)).toBe("choose");
  expect(entryState(terms(), both, 1_000, false)).toBe("closed");
  expect(entryState(terms({ lords: 0n }), both, 2_000, false)).toBe("closed");
  const seated = {
    registered: true,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 1n,
    refundable: false,
    gameId: 0,
  };
  // Past the close a registration is still only registered until a game's roster names the wallet.
  expect(entryState(terms({ registration: seated }), both, 2_000, false)).toBe("registered");
  // Seated for the whole game: the roster froze the wallet, though the ledger binds the game only at its result.
  expect(entryState(terms({ registration: seated }), both, 2_000, true)).toBe("seated");
  // Settled: the ledger names the game, and the game has left the directory.
  expect(entryState(terms({ registration: { ...seated, gameId: 7 } }), both, 2_000, false)).toBe("seated");
  // A roster seat never hides a refund the ledger owes.
  expect(entryState(terms({ registration: { ...seated, refundable: true } }), both, 2_000, true)).toBe("refund");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 2_000, false)).toBe("refund");
});

it("refunds a registration the slot's close left unseated, as a cancelled slot's, never one a game consumed", () => {
  const both = { sword: false, shield: false };
  const unseated = {
    registered: true,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 500n * WEI,
    refundable: true,
    gameId: 0,
  };
  expect(entryState(terms({ registration: unseated }), both, 2_000, false)).toBe("refund");
  expect(entryState(terms({ registration: { ...unseated, paid: 0n } }), both, 2_000, false)).toBe("refunded");
  // A registration a game consumed is never owed back, whatever became of its slot: the ledger refuses it.
  expect(
    entryState(
      terms({ registration: { ...unseated, refundable: false, gameId: 7 }, cancelled: true }),
      both,
      2_000,
      false,
    ),
  ).toBe("seated");
  // A registration is uncapped: no count of others ever turns a payer away before close.
  expect(entryState(terms(), both, 900, false)).toBe("choose");
});
