import { describe, expect, it } from "vitest";
import { productionOutput, productionEndsAt } from "./production-output";

describe("production paid by the second", () => {
  const farm = { remainder: 0, last_settled_at: 40, production_rate: 7n };

  it("pays one second between consecutive settles and the same total for one long settle", () => {
    let total = 0n;
    for (let timestamp = 41; timestamp <= 3640; timestamp++) {
      const paid = productionOutput({ ...farm, last_settled_at: timestamp - 1 }, timestamp);
      expect(paid).toBe(7n);
      total += paid;
    }
    expect(total).toBe(3600n * 7n);
    expect(productionOutput(farm, 3640)).toBe(total);
  });

  it("never pays before the exact start or twice for the same second", () => {
    expect(productionOutput(farm, 39)).toBe(0n);
    expect(productionOutput(farm, 40)).toBe(0n);
    expect(productionOutput(farm, 41)).toBe(7n);
    expect(productionOutput(farm, 59)).toBe(133n);
    expect(productionOutput(farm, 60)).toBe(140n);
  });

  it("refuses invalid clocks", () => {
    for (const timestamp of [NaN, Infinity, 40.5]) {
      expect(() => productionOutput(farm, timestamp)).toThrow("clock");
      expect(() => productionOutput({ ...farm, last_settled_at: timestamp }, 100)).toThrow("clock");
    }
  });
});

it("splits output at a bane's start and early end without losing fractional output", () => {
  const rates = (from: number, until: number) => {
    const start = Math.max(50, from),
      end = Math.min(71, until);
    return start < end ? [{ start, end, percent: 50 }] : [];
  };
  const farm = { last_settled_at: 40, production_rate: 7n, remainder: 0, rates };
  expect(productionOutput(farm, 55)).toBe(87n);
  expect(productionOutput({ ...farm, last_settled_at: 60 }, 80)).toBe(101n);
  expect(productionOutput(farm, 80)).toBe(206n);
  expect(productionEndsAt(farm, 206n)).toBe(80);
  expect(productionEndsAt(farm, 207n)).toBe(81);
  const atEdge = { ...farm, last_settled_at: 51, remainder: 50 };
  expect(productionOutput(farm, 51) + productionOutput(atEdge, 80)).toBe(206n);
});
