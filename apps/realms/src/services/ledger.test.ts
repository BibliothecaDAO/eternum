import { describe, expect, it } from "vitest";

import { computePayouts, registrationTotal, type RegistrationPricing } from "./payouts";

const LORDS = 10n ** 18n;

// The lab preset from the backend brief B.1: entry 500, cut 20%, top 20% paid,
// decay 0.96 — at 96 seats the brief quotes rank 1 ≈ 2,752 and rank 20 ≈ 1,267.
const labPreset = {
  pool: 48_000n * LORDS,
  protocolCutBps: 2000,
  paidFractionBps: 2000,
  decayBps: 9600,
  seats: 96,
};

describe("computePayouts", () => {
  it("reproduces the B.1 lab curve at 96 seats", () => {
    const { winners, cut, prizePool, allocations } = computePayouts(labPreset);
    expect(winners).toBe(20);
    expect(cut).toBe(9_600n * LORDS);
    expect(prizePool).toBe(38_400n * LORDS);
    expect(allocations).toHaveLength(20);
    expect(allocations[0]! / LORDS).toBe(2752n);
    expect(allocations[19]! / LORDS).toBe(1267n);
  });

  it("never allocates more than the prize pool", () => {
    const { prizePool, allocations } = computePayouts(labPreset);
    const total = allocations.reduce((sum, value) => sum + value, 0n);
    expect(total <= prizePool).toBe(true);
  });

  it("pays a single winner the whole prize pool at tiny rosters", () => {
    const { winners, allocations, prizePool } = computePayouts({ ...labPreset, seats: 2, pool: 1000n * LORDS });
    expect(winners).toBe(1);
    expect(allocations[0]).toBe(prizePool);
  });

  it("returns no winners for an empty pool", () => {
    const { winners, allocations } = computePayouts({ ...labPreset, pool: 0n });
    expect(winners).toBe(0);
    expect(allocations).toHaveLength(0);
  });
});

describe("registrationTotal", () => {
  const preset: RegistrationPricing = {
    entryFee: 500n * LORDS,
    swordPrice: 500n * LORDS,
    shieldPrice: 500n * LORDS,
  };

  it("sums the entry with the chosen modifiers", () => {
    expect(registrationTotal(preset, { sword: false, shield: false })).toBe(500n * LORDS);
    expect(registrationTotal(preset, { sword: true, shield: false })).toBe(1000n * LORDS);
    expect(registrationTotal(preset, { sword: true, shield: true })).toBe(1500n * LORDS);
  });
});
