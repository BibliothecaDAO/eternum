import { describe, expect, it } from "vitest";
import { FRAGMENT, roundUpLords, SEAL_CENTS, SEAL_FREE, SEAL_HOLDERS, STORE_PRODUCTS } from "./shop";

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

describe("the Ancient Seal's holder levels", () => {
  it("charges a holder half and gives a Wonder or golden holder the Fragments free as well", () => {
    expect(SEAL_HOLDERS.map((holder) => SEAL_CENTS.web[holder])).toEqual([1_000, 499, 499]);
    expect(SEAL_HOLDERS.map((holder) => SEAL_CENTS.store[holder])).toEqual([999, 499, 499]);
    expect(SEAL_HOLDERS.map((holder) => SEAL_FREE[holder])).toEqual([
      { labor: false, fragments: false },
      { labor: true, fragments: false },
      { labor: true, fragments: true },
    ]);
  });
});

describe("what the stores sell", () => {
  it("sells Fragments a cent each or a little under, and the seal at the seal's own store prices", () => {
    for (const product of Object.values(STORE_PRODUCTS))
      if (product.kind === "fragments") {
        expect(product.fragments * FRAGMENT.cents).toBeGreaterThanOrEqual(product.cents);
        expect(product.fragments * FRAGMENT.cents - product.cents).toBeLessThanOrEqual(1);
      }
    expect(STORE_PRODUCTS.seal.cents).toBe(SEAL_CENTS.store.none);
    expect(STORE_PRODUCTS["seal-holder"].cents).toBe(SEAL_CENTS.store.realm);
    expect(SEAL_CENTS.store.realm).toBe(SEAL_CENTS.store.wonder);
  });
});
