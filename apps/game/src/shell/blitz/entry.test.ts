import { expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { entryCost, entryState, type EntryTerms, slotLedgerOf } from "./entry";

const WEI = 10n ** 18n;
const terms = (overrides: Partial<EntryTerms> = {}): EntryTerms => ({
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  cancelled: false,
  credits: { swords: 0, shields: 0 },
  registration: { registered: false, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
  lords: 2_140n * WEI,
  strk: 10n ** 17n,
  ...overrides,
});

it("charges the seat and each flag, a held credit paying for its flag", () => {
  expect(entryCost(terms(), { sword: true, shield: true }).cash).toBe(1_500n * WEI);
  const credited = entryCost(terms({ credits: { swords: 2, shields: 0 } }), { sword: true, shield: true });
  expect(credited).toEqual({ cash: 1_000n * WEI, swordCredit: true, shieldCredit: false });
});

it("tells choosing, short of LORDS, no STRK for the fee, seated, refund and refunded apart", () => {
  const both = { sword: true, shield: true };
  expect(entryState(terms(), both)).toBe("choose");
  expect(entryState(terms({ lords: 320n * WEI }), both)).toBe("short");
  expect(entryState(terms({ strk: 0n }), both)).toBe("no-strk");
  const seated = {
    registered: true,
    sword: true,
    shield: true,
    swordCredit: true,
    shieldCredit: false,
    paid: 1_000n * WEI,
  };
  expect(entryState(terms({ registration: seated }), both)).toBe("seated");
  expect(entryState(terms({ registration: seated, cancelled: true }), both)).toBe("refund");
  const back = { ...seated, swordCredit: false, paid: 0n };
  expect(entryState(terms({ registration: back, cancelled: true }), both)).toBe("refunded");
});

it("reads the ledger game a slot fills, and none from a slot that names none", () => {
  const slot = (ledger: unknown) => ({ name: "blitz-1630", ledger }) as unknown as PlaytestSlot;
  expect(slotLedgerOf(slot(undefined))).toBeNull();
  expect(slotLedgerOf(slot({ address: "0xl", shard: "0x52", gameId: 7 }))).toEqual({
    address: "0xl",
    key: { shard: "0x52", gameId: 7 },
  });
  expect(slotLedgerOf(slot({ address: "0xl", shard: "0x52" }))).toBeNull();
});
