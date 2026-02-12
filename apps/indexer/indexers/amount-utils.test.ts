import { describe, expect, it } from "vitest";

import { toDecimalAmount } from "./amount-utils";

describe("toDecimalAmount", () => {
  it("keeps large integer strings intact", () => {
    expect(
      toDecimalAmount("1234567890123456789012345678901234567890"),
    ).toBe("1234567890123456789012345678901234567890");
  });

  it("converts uint256-like values to decimal string without precision loss", () => {
    const max128 = "340282366920938463463374607431768211455";
    expect(toDecimalAmount({ low: max128, high: 1n })).toBe(
      "680564733841876926926749214863536422911",
    );
  });
});
