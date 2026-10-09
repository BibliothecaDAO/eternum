import { expect, it } from "vitest";
import { safeInteger } from "./safe-integer";
it("preserves representable native integers and refuses rounding at numeric API boundaries", () => {
  expect(safeInteger(4294967297n)).toBe(4294967297);
  expect(safeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  for (const value of [BigInt(Number.MAX_SAFE_INTEGER) + 1n, (1n << 56n) + 19n, 1.5, NaN, Infinity])
    expect(() => safeInteger(value)).toThrow("cannot be represented");
});
