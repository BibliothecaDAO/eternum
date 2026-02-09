import { describe, it, expect } from "vitest";
import { computeOutputAmount, computeSlippage, computeMarketPrice } from "../../src/compute/market.js";

describe("computeOutputAmount", () => {
  it("should compute basic swap with zero fee", () => {
    // x * y = k constant product
    // inputAmount = 1000, inputReserve = 10000, outputReserve = 10000
    // output = (1000 * 10000) / (10000 + 1000) = 10000000 / 11000 = ~909
    const output = computeOutputAmount(1000, 10000, 10000, 0, 1000);
    expect(output).toBeCloseTo(909, 0);
  });

  it("should compute swap with 3% fee", () => {
    // feeNum = 30, feeDenom = 1000 means 3% fee
    // effectiveInput = 1000 * (1000 - 30) / 1000 = 970
    // output = (970 * 10000) / (10000 + 970) = 9700000 / 10970 = ~884
    const outputWithFee = computeOutputAmount(1000, 10000, 10000, 30, 1000);
    const outputNoFee = computeOutputAmount(1000, 10000, 10000, 0, 1000);

    expect(outputWithFee).toBeLessThan(outputNoFee);
    expect(outputWithFee).toBeCloseTo(884, 0);
  });

  it("should return 0 for zero input", () => {
    const output = computeOutputAmount(0, 10000, 10000, 30, 1000);
    expect(output).toBe(0);
  });

  it("should handle asymmetric reserves", () => {
    // If lords reserve is much higher, resource is expensive
    const output = computeOutputAmount(1000, 50000, 5000, 0, 1000);
    // output = (1000 * 5000) / (50000 + 1000) = 5000000 / 51000 = ~98
    expect(output).toBeCloseTo(98, 0);
  });
});

describe("computeSlippage", () => {
  it("should return low slippage for small trades relative to reserves", () => {
    const slippage = computeSlippage(10, 10000, 10000);
    expect(slippage).toBeLessThan(1); // Less than 1% slippage
  });

  it("should return higher slippage for larger trades", () => {
    const smallSlippage = computeSlippage(100, 10000, 10000);
    const largeSlippage = computeSlippage(5000, 10000, 10000);

    expect(largeSlippage).toBeGreaterThan(smallSlippage);
  });

  it("should return 0 for zero input", () => {
    const slippage = computeSlippage(0, 10000, 10000);
    expect(slippage).toBe(0);
  });

  it("should return high slippage for trade equal to reserve", () => {
    const slippage = computeSlippage(10000, 10000, 10000);
    // Ideal: 10000 output, actual: 10000*10000/20000 = 5000, slippage = 50%
    expect(slippage).toBeCloseTo(50, 0);
  });
});

describe("computeMarketPrice", () => {
  it("should return ratio of lords to resource", () => {
    const price = computeMarketPrice(10000, 5000);
    expect(price).toBe(2); // 10000/5000 = 2 lords per resource
  });

  it("should return 1 for equal reserves", () => {
    const price = computeMarketPrice(10000, 10000);
    expect(price).toBe(1);
  });

  it("should return 0 for zero lords reserve", () => {
    const price = computeMarketPrice(0, 10000);
    expect(price).toBe(0);
  });

  it("should handle fractional prices", () => {
    const price = computeMarketPrice(5000, 10000);
    expect(price).toBe(0.5);
  });

  it("should return Infinity for zero resource reserve", () => {
    const price = computeMarketPrice(1000, 0);
    expect(price).toBe(Infinity);
  });
});
