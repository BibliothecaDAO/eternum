import { expect, it } from "vitest";

import { entryCost, entryLinkOf, entryShares, entryState, type EntryTerms } from "./entry";

const WEI = 10n ** 18n;
const terms = (overrides: Partial<EntryTerms> = {}): EntryTerms => ({
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 2000, chestLordsBps: 500 },
  cancelled: false,
  start: 1_000,
  credits: { swords: 0, shields: 0 },
  registration: { registered: false, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
  lordsToken: "0x10e5",
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
  expect(entryState(terms(), both, 900, "confirmed")).toBe("choose");
  expect(entryState(terms({ lords: 320n * WEI }), both, 900, "confirmed")).toBe("short");
  expect(entryState(terms({ strk: 0n }), both, 900, "confirmed")).toBe("no-strk");
  const seated = {
    registered: true,
    sword: true,
    shield: true,
    swordCredit: true,
    shieldCredit: false,
    paid: 1_000n * WEI,
  };
  expect(entryState(terms({ registration: seated }), both, 900, "confirmed")).toBe("seated");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 900, "confirmed")).toBe("refund");
  const back = { ...seated, swordCredit: false, paid: 0n };
  expect(entryState(terms({ registration: back, cancelled: true }), both, 900, "confirmed")).toBe("refunded");
});

it("closes the entry once the game has started, for anyone not already seated", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 999, "confirmed")).toBe("choose");
  expect(entryState(terms(), both, 1_000, "confirmed")).toBe("closed");
  expect(entryState(terms({ lords: 0n }), both, 2_000, "confirmed")).toBe("closed");
  const seated = { registered: true, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 1n };
  expect(entryState(terms({ registration: seated }), both, 2_000, "confirmed")).toBe("seated");
  expect(entryState(terms({ registration: seated, cancelled: true }), both, 2_000, "confirmed")).toBe("refund");
});

const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", feeToken: "0x57e1", shard: "0x52", gameId: 7 };
const CONFIRMED = {
  status: "confirmed" as const,
  ledger: { address: "0x1ed9e7", chainId: "0x534e5f4d41494e" },
  wallet: "0x4a1",
  account: "0x7a",
};

it("opens the entry only once the services confirm this wallet's link to this account on this ledger", () => {
  expect(entryLinkOf(CONFIRMED, LEDGER, "0x4a1", "0x7a")).toBe("confirmed");
  // The same felts written another way are the same link.
  expect(entryLinkOf({ ...CONFIRMED, wallet: "0x04a1" }, LEDGER, "0x4a1", "0x007a")).toBe("confirmed");
  expect(entryLinkOf({ status: "linking" }, LEDGER, "0x4a1", "0x7a")).toBe("linking");
  // Confirmed for a wallet the player has since replaced: the replacement is still syncing.
  expect(entryLinkOf({ ...CONFIRMED, wallet: "0x999" }, LEDGER, "0x4a1", "0x7a")).toBe("linking");
  expect(entryLinkOf({ ...CONFIRMED, wallet: null }, LEDGER, "0x4a1", "0x7a")).toBe("linking");
  // Confirmed on another ledger or chain: a mismatch that never resolves, so a fault, never "linking".
  expect(entryLinkOf({ ...CONFIRMED, ledger: { ...CONFIRMED.ledger, address: "0x2" } }, LEDGER, "0x4a1", "0x7a")).toBe(
    "other-ledger",
  );
  expect(entryLinkOf(CONFIRMED, { ...LEDGER, chainId: "0x534e5f5345504f4c4941" }, "0x4a1", "0x7a")).toBe(
    "other-ledger",
  );
  // Confirmed for another account: a fault, never a payment.
  expect(entryLinkOf(CONFIRMED, LEDGER, "0x4a1", "0x99")).toBe("elsewhere");
});

it("waits while linking, refuses a link for another account, and keeps closed and seated first", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both, 900, "linking")).toBe("linking");
  expect(entryState(terms(), both, 900, "elsewhere")).toBe("linked-elsewhere");
  expect(entryState(terms(), both, 900, "other-ledger")).toBe("linked-other-ledger");
  expect(entryState(terms(), both, 900, "confirmed")).toBe("choose");
  expect(entryState(terms(), both, 1_000, "linking")).toBe("closed");
  const seated = { registered: true, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 1n };
  expect(entryState(terms({ registration: seated }), both, 900, "elsewhere")).toBe("seated");
});
