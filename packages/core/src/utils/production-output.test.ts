import { describe, expect, it } from "vitest";
import { productionOutput } from "./production-output";

describe("daily Support production integral", () => {
  const production = { last_updated_at: 86400 - 10, production_rate: 100n };
  it("keeps yesterday's accrued bonus without boosting today's seconds", () => {
    const support = { epochSeconds: 86400, level: 3 };
    expect(productionOutput(production, 86400 - 1, support)).toBe(1080n);
    expect(productionOutput(production, 86400, support)).toBe(1200n);
    expect(productionOutput(production, 86400 + 10, support)).toBe(2200n);
    expect(productionOutput(production, 86400 + 86400, support)).toBe(8641200n);
  });
  it("treats declared level zero as no earned bonus and keeps non-Frontier output unchanged", () => {
    expect(productionOutput(production, 86410, { epochSeconds: 86400, level: 0 })).toBe(2000n);
    expect(productionOutput(production, 86410, null)).toBe(2000n);
  });
  it("floors the bonus once after multiplying duration and rate, and refuses invalid clocks or levels", () => {
    expect(productionOutput({ last_updated_at: 99, production_rate: 3n }, 101, { epochSeconds: 100, level: 5 })).toBe(
      7n,
    );
    expect(() => productionOutput(production, NaN, null)).toThrow("clock");
    expect(() => productionOutput(production, 86410, { epochSeconds: 86400, level: 6 })).toThrow("level");
  });
});
