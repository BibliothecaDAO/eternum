import { describe, expect, it } from "vitest";
import { FRAGMENT_CENTS, roundUpLords, STORE_PRODUCTS } from "./shop";

describe("the shop's prices in LORDS", () => {
  const lords = (amount: number) => BigInt(Math.round(amount * 1e6)) * 10n ** 12n;

  it("rounds a quote up to a multiple of 5, never down, so a price cannot undercharge and always ends in 5 or 0", () => {
    expect(roundUpLords(lords(2_749.5))).toBe(2_750);
    expect(roundUpLords(lords(1_372.01))).toBe(1_375);
    expect(roundUpLords(lords(2_000))).toBe(2_000);
    expect(roundUpLords(lords(0.000001))).toBe(5);
    expect(roundUpLords(lords(2_000.000001))).toBe(2_005);
  });

  it("keeps the amount exact to the largest whole number a number holds, and refuses what it cannot", () => {
    // 9,007,199,254,740,990 is the largest multiple of 5 at or below Number.MAX_SAFE_INTEGER.
    const largest = 9_007_199_254_740_990n;
    expect(roundUpLords(largest * 10n ** 18n)).toBe(9_007_199_254_740_990);
    expect(roundUpLords((largest - 4n) * 10n ** 18n)).toBe(9_007_199_254_740_990);
    expect(() => roundUpLords((largest + 1n) * 10n ** 18n)).toThrow("more than a number holds");
    expect(() => roundUpLords(10n ** 400n)).toThrow("more than a number holds");
  });

  it("refuses an amount that is missing or zero", () => {
    expect(() => roundUpLords(0n)).toThrow();
    expect(() => roundUpLords(-1n)).toThrow();
  });
});

describe("what the stores sell", () => {
  it("sells Fragments a cent each or a little under", () => {
    for (const product of Object.values(STORE_PRODUCTS)) {
      expect(product.fragments * FRAGMENT_CENTS).toBeGreaterThanOrEqual(product.cents);
      expect(product.fragments * FRAGMENT_CENTS - product.cents).toBeLessThanOrEqual(1);
    }
  });
});
