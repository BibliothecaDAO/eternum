import { describe, expect, it } from "vitest";
import { FRAGMENT, FRAGMENT_PRICES, lordsFor, SEAL_CENTS, SEAL_FREE, SEAL_HOLDERS } from "./shop";

/** The frozen design's day: LORDS at $0.003637, so $1 is 275 LORDS. */
const PRICE = 0.003637;

describe("the shop's prices in LORDS", () => {
  it("quotes the design's numbers at its day's price", () => {
    expect(lordsFor(100 * FRAGMENT.cents, PRICE)).toBe(275);
    expect(lordsFor(SEAL_CENTS.web.none, PRICE)).toBe(2_750);
    // The design says about 1,372: whole LORDS rounded up make it 1,373.
    expect(lordsFor(SEAL_CENTS.web.realm, PRICE)).toBe(1_373);
    // A full bar of stamina: 90 Fragments, $0.90.
    expect(lordsFor(90 * FRAGMENT.cents, PRICE)).toBe(248);
    expect(lordsFor(FRAGMENT_PRICES.questReroll * FRAGMENT.cents, PRICE)).toBe(138);
  });

  it("rounds up, never down, so a price cannot undercharge", () => {
    expect(lordsFor(1, 0.01)).toBe(1);
    expect(lordsFor(101, 0.01)).toBe(101);
    expect(lordsFor(1, 0.0099)).toBe(2);
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
