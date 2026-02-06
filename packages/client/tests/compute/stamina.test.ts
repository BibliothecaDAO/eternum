import { describe, it, expect } from "vitest";
import { computeStamina } from "../../src/compute/stamina.js";

describe("computeStamina", () => {
  it("should regenerate stamina over elapsed ticks", () => {
    const result = computeStamina({
      currentAmount: 0,
      lastUpdateTick: 0,
      currentTick: 10,
      maxStamina: 100,
      regenPerTick: 5,
    });

    expect(result.current).toBe(50); // 10 ticks * 5 regen
    expect(result.max).toBe(100);
  });

  it("should cap stamina at max", () => {
    const result = computeStamina({
      currentAmount: 90,
      lastUpdateTick: 0,
      currentTick: 10,
      maxStamina: 100,
      regenPerTick: 5,
    });

    // 90 + (10 * 5) = 140, but capped at 100
    expect(result.current).toBe(100);
    expect(result.ticksUntilFull).toBe(0);
  });

  it("should return current amount when no time has passed", () => {
    const result = computeStamina({
      currentAmount: 42,
      lastUpdateTick: 10,
      currentTick: 10,
      maxStamina: 100,
      regenPerTick: 5,
    });

    expect(result.current).toBe(42);
  });

  it("should add boost to regen rate", () => {
    const resultWithout = computeStamina({
      currentAmount: 0,
      lastUpdateTick: 0,
      currentTick: 10,
      maxStamina: 100,
      regenPerTick: 5,
    });

    const resultWith = computeStamina({
      currentAmount: 0,
      lastUpdateTick: 0,
      currentTick: 10,
      maxStamina: 100,
      regenPerTick: 5,
      boost: 3,
    });

    // Without boost: 10 * 5 = 50
    // With boost: 10 * (5 + 3) = 80
    expect(resultWithout.current).toBe(50);
    expect(resultWith.current).toBe(80);
  });

  it("should calculate ticks until full", () => {
    const result = computeStamina({
      currentAmount: 0,
      lastUpdateTick: 0,
      currentTick: 0,
      maxStamina: 100,
      regenPerTick: 5,
    });

    // Need 100 stamina at 5/tick = 20 ticks
    expect(result.current).toBe(0);
    expect(result.ticksUntilFull).toBe(20);
  });

  it("should return zero ticks until full when already at max", () => {
    const result = computeStamina({
      currentAmount: 100,
      lastUpdateTick: 0,
      currentTick: 0,
      maxStamina: 100,
      regenPerTick: 5,
    });

    expect(result.current).toBe(100);
    expect(result.ticksUntilFull).toBe(0);
  });

  it("should handle zero regen rate", () => {
    const result = computeStamina({
      currentAmount: 30,
      lastUpdateTick: 0,
      currentTick: 100,
      maxStamina: 100,
      regenPerTick: 0,
    });

    expect(result.current).toBe(30);
    expect(result.ticksUntilFull).toBe(Infinity);
  });
});
