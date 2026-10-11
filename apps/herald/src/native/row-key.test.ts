import { describe, expect, it } from "vitest";
import { nativeRowKey } from "./row-key";

describe("native row keys", () => {
  it("normalizes felts without losing tuple boundaries, order or precision", () => {
    expect(nativeRowKey(["0x01", 7, 9007199254740993n])).toBe("0x1:0x7:0x20000000000001");
    expect(nativeRowKey(["1", "0x07"])).toBe(nativeRowKey([1n, 7n]));
    const keys = [[1, 23], [12, 3], [23, 1], [1, 2, 3], [1, 23, 0], [123]];
    expect(new Set(keys.map(nativeRowKey)).size).toBe(keys.length);
  });

  it("refuses empty keys, unsafe numbers and out-of-field felts", () => {
    expect(() => nativeRowKey([])).toThrow("at least one felt");
    expect(() => nativeRowKey([Number.MAX_SAFE_INTEGER + 1])).toThrow("Unsafe row key");
    for (const value of [-1n, (1n << 251n) + 17n * (1n << 192n) + 1n])
      expect(() => nativeRowKey([value])).toThrow("Not a felt");
  });
});
