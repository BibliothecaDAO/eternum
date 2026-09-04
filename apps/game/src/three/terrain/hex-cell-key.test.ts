import { describe, expect, it } from "vitest";

import { hexCellFromKey, hexCellKey } from "./hex-cell-key";

describe("hexCellKey", () => {
  it("packs col and row into one dense integer without collisions", () => {
    expect(hexCellKey(-32_768, -32_768)).toBe(0);
    expect(hexCellKey(32_767, 32_767)).toBe(2 ** 32 - 1);
    expect(hexCellKey(1, 0)).not.toBe(hexCellKey(0, 1));
  });

  it("round-trips through hexCellFromKey", () => {
    for (const [col, row] of [
      [0, 0],
      [-7, 12],
      [32_767, -32_768],
      [-32_768, 32_767],
    ]) {
      expect(hexCellFromKey(hexCellKey(col, row))).toEqual({ col, row });
    }
  });

  it("rejects coordinates outside the packed range or non-integers", () => {
    expect(() => hexCellKey(32_768, 0)).toThrow(/col must be an integer/);
    expect(() => hexCellKey(0, 1.5)).toThrow(/row must be an integer/);
  });
});
