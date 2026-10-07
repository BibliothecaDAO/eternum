import { describe, expect, it } from "vitest";
import { productionOutput } from "./production-output";

describe("production output", () => {
  const production = { last_updated_at: 86400 - 10, production_rate: 100n };
  it("integrates the rate over elapsed seconds, across midnight alike", () => {
    expect(productionOutput(production, 86400 - 1)).toBe(900n);
    expect(productionOutput(production, 86400 + 10)).toBe(2000n);
    expect(productionOutput(production, 86400 - 20)).toBe(0n);
  });
  it("refuses invalid clocks", () => {
    expect(() => productionOutput(production, NaN)).toThrow("clock");
  });
});
