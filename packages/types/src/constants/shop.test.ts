import { describe, expect, it } from "vitest";
import { FRAGMENT, lordsFor, SEAL_CENTS, SEAL_FREE, SEAL_HOLDERS, STORE_PRODUCTS } from "./shop";

/** The frozen design's price: LORDS at $0.003637, so $1 is 275 LORDS. */
const PRICE = 0.003637;

describe("the shop's prices in LORDS", () => {
  it("quotes the design's numbers at that price", () => {
    expect(lordsFor(100 * FRAGMENT.cents, PRICE)).toBe(275);
    expect(lordsFor(SEAL_CENTS.web.none, PRICE)).toBe(2_750);
    // The design says about 1,372; 1,373 whole LORDS rounds up to the next multiple of 5.
    expect(lordsFor(SEAL_CENTS.web.realm, PRICE)).toBe(1_375);
    // A full bar of stamina: 90 Fragments, $0.90, is 247.5 LORDS.
    expect(lordsFor(90 * FRAGMENT.cents, PRICE)).toBe(250);
  });

  it("rounds up to a multiple of 5, never down, so a price cannot undercharge and always ends in 5 or 0", () => {
    expect(lordsFor(1, 0.01)).toBe(5);
    expect(lordsFor(500, 0.01)).toBe(500);
    expect(lordsFor(501, 0.01)).toBe(505);
    expect(lordsFor(1, 0.0099)).toBe(5);
  });

  it("refuses a price that is missing, zero or broken", () => {
    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => lordsFor(100, price)).toThrow();
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
