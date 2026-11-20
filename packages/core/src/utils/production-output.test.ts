import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productionOutput } from "./production-output";

describe("production paid by the second", () => {
  const farm = { last_settled_at: 40, production_rate: 7n, remainder: 0 };

  it("pays one second between consecutive settles and the same total for one long settle", () => {
    let total = 0n;
    for (let timestamp = 41; timestamp <= 3640; timestamp++) {
      const paid = productionOutput({ ...farm, last_settled_at: timestamp - 1 }, timestamp, [], 100);
      expect(paid).toEqual({ amount: 7n, remainder: 0 });
      total += paid.amount;
    }
    expect(total).toBe(3600n * 7n);
    expect(productionOutput(farm, 3640, [], 100)).toEqual({ amount: total, remainder: 0 });
  });

  it("never pays before the exact start or twice for the same second", () => {
    expect(productionOutput(farm, 39, [], 100)).toEqual({ amount: 0n, remainder: 0 });
    expect(productionOutput(farm, 40, [], 100)).toEqual({ amount: 0n, remainder: 0 });
    expect(productionOutput(farm, 41, [], 100)).toEqual({ amount: 7n, remainder: 0 });
    expect(productionOutput(farm, 59, [], 100)).toEqual({ amount: 133n, remainder: 0 });
    expect(productionOutput(farm, 60, [], 100)).toEqual({ amount: 140n, remainder: 0 });
  });

  it("refuses invalid clocks", () => {
    for (const timestamp of [NaN, Infinity, 40.5]) {
      expect(() => productionOutput(farm, timestamp, [], 100)).toThrow("clock");
      expect(() => productionOutput({ ...farm, last_settled_at: timestamp }, 100, [], 100)).toThrow("clock");
    }
  });
});

it("matches the native vectors across ordinary output, bane edges and carried fractions", () => {
  const words = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/production-banes.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  let cursor = 0;
  const next = () => {
    const value = words[cursor++];
    if (value === undefined) throw new Error("Truncated production vector");
    return value;
  };
  const count = Number(next());
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    const production_rate = next();
    const last_settled_at = Number(next());
    const until = Number(next());
    const remainder = Number(next());
    const percent = Number(next());
    const windows = Array.from({ length: Number(next()) }, () => ({
      kind: Number(next()),
      start: Number(next()),
      end: Number(next()),
    }));
    const amount = next();
    const finalRemainder = Number(next());
    expect(productionOutput({ production_rate, last_settled_at, remainder }, until, windows, percent)).toEqual({
      amount,
      remainder: finalRemainder,
    });
  }
  expect(cursor).toBe(words.length);
});
