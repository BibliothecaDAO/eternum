import { expect, it } from "vitest";

import { entryCost, entryShares, entryState, type EntryTerms } from "./entry";

const WEI = 10n ** 18n;
/** The player's own Realms account, which the ledger links to the payout wallet in these terms. */
const ACCOUNT = "0x7a";
const terms = (overrides: Partial<EntryTerms> = {}): EntryTerms => ({
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 2000, chestLordsBps: 500 },
  cancelled: false,
  start: 1_000,
  credits: { swords: 0, shields: 0 },
  registration: { registered: false, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
  lordsToken: "0x10e5",
  linkedAccount: "0x7a",
  lords: 2_140n * WEI,
  strk: 10n ** 17n,
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

it("tells choosing, short of LORDS, no STRK for the fee, seated, refund and refunded apart", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 900, ACCOUNT)).toBe("choose");
  expect(entryState(terms({ lords: 320n * WEI }), both, 900, ACCOUNT)).toBe("short");
  expect(entryState(terms({ strk: 0n }), both, 900, ACCOUNT)).toBe("no-strk");
  const seated = {
    registered: true,
    sword: true,
    shield: true,
    swordCredit: true,
    shieldCredit: false,
    paid: 1_000n * WEI,
  };
  expect(entryState(terms({ registration: seated }), both, 900, ACCOUNT)).toBe("seated");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 900, ACCOUNT)).toBe("refund");
  const back = { ...seated, swordCredit: false, paid: 0n };
  expect(entryState(terms({ registration: back, cancelled: true }), both, 900, ACCOUNT)).toBe("refunded");
});

it("closes the entry once the game has started, for anyone not already seated", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 999, ACCOUNT)).toBe("choose");
  expect(entryState(terms(), both, 1_000, ACCOUNT)).toBe("closed");
  expect(entryState(terms({ lords: 0n }), both, 2_000, ACCOUNT)).toBe("closed");
  const seated = { registered: true, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 1n };
  expect(entryState(terms({ registration: seated }), both, 2_000, ACCOUNT)).toBe("seated");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 2_000, ACCOUNT)).toBe("refund");
});

it("waits while the ledger links the payout wallet, and refuses a wallet linked to another account", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms({ linkedAccount: "0x0" }), both, 900, ACCOUNT)).toBe("linking");
  expect(entryState(terms({ linkedAccount: "0x0" }), both, 900, "0x0")).toBe("linking");
  expect(entryState(terms({ linkedAccount: "0x99" }), both, 900, ACCOUNT)).toBe("linked-elsewhere");
  // The same account, written another way, is linked.
  expect(entryState(terms({ linkedAccount: "0x007a" }), both, 900, ACCOUNT)).toBe("choose");
  // A started game is closed, and a seated player stays seated, whatever the link says now.
  expect(entryState(terms({ linkedAccount: "0x0" }), both, 1_000, ACCOUNT)).toBe("closed");
  const seated = { registered: true, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 1n };
  expect(entryState(terms({ linkedAccount: "0x99", registration: seated }), both, 900, ACCOUNT)).toBe("seated");
});
