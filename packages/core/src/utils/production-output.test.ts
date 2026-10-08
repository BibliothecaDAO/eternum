import { describe, expect, it } from "vitest";
import { productionOutput } from "./production-output";

describe("production in whole armies ticks", () => {
  const farm = { last_settled_tick: 0, production_rate: 100n };
  it("pays every ended tick in full and nothing of the tick in progress", () => {
    expect(productionOutput(farm, 119, 120)).toBe(0n);
    expect(productionOutput(farm, 120, 120)).toBe(12_000n);
    expect(productionOutput(farm, 359, 120)).toBe(24_000n);
  });
  it("totals an hour of a minute tick exactly as the hour's seconds, from any start", () => {
    const started = { last_settled_tick: Math.floor(40 / 60), production_rate: 7n };
    expect(productionOutput(started, 40 + 3600, 60)).toBe(3600n * 7n);
  });
  it("refuses a missing or zero tick", () => {
    expect(() => productionOutput(farm, 120, 0)).toThrow("tick");
  });
});

describe("production clocks", () => {
  it("refuses invalid timestamps", () => {
    expect(() => productionOutput({ last_settled_tick: 0, production_rate: 100n }, NaN, 120)).toThrow("clock");
  });
});
