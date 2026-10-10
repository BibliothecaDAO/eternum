import { expect, it } from "vitest";
import { safeInteger } from "./safe-integer";
it("preserves representable native integers and refuses rounding at numeric API boundaries", () => {
  expect(safeInteger(4294967297n)).toBe(4294967297);
  expect(safeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  for (const value of [BigInt(Number.MAX_SAFE_INTEGER) + 1n, (1n << 56n) + 19n, 1.5, NaN, Infinity])
    expect(() => safeInteger(value)).toThrow("cannot be represented");
});

it("reads an id from Herald or story JSON exactly, through BigInt, and never as NaN, a rounding or a zero", () => {
  expect(safeInteger("4294967297")).toBe(4294967297);
  expect(safeInteger("0x1fffffffffffff")).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => safeInteger("9007199254740993")).toThrow("cannot be represented");
  for (const value of ["", " ", "12abc", "1.5", "NaN"]) expect(() => safeInteger(value)).toThrow();
});
