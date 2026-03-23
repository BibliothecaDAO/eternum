import { describe, expect, it } from "vitest";
import {
  computeAddLiquidity,
  computeLpBurn,
  computeLpMint,
  getInputPrice,
  getOutputPrice,
  quote,
} from "../src/utils/math";
import { computeMinimumReceived, computePriceImpact, computeSpotPrice } from "../src/utils/price";

const FEE_NUM = 3n;
const FEE_DENOM = 1000n;

describe("getInputPrice", () => {
  it("should compute correct output with no fee", () => {
    // Pool: 170,000 LORDS / 150,000 tokens
    // Sell 17,500 tokens -> expect 17,761 LORDS
    const output = getInputPrice(0n, 1n, 17_500n, 150_000n, 170_000n);
    expect(output).toBe(17_761n);
  });

  it("should compute correct output with 0.3% fee", () => {
    // Pool: 170,000 LORDS / 150,000 tokens, 0.3% fee
    // Sell 17,500 tokens -> expect 17,713 LORDS
    const output = getInputPrice(FEE_NUM, FEE_DENOM, 17_500n, 150_000n, 170_000n);
    expect(output).toBe(17_713n);
  });

  it("should throw on zero reserves", () => {
    expect(() => getInputPrice(FEE_NUM, FEE_DENOM, 100n, 0n, 100n)).toThrow("reserves must be > zero");
  });

  it("should throw on zero input amount", () => {
    expect(() => getInputPrice(FEE_NUM, FEE_DENOM, 0n, 100n, 100n)).toThrow("input amount must be > zero");
  });
});

describe("getOutputPrice", () => {
  it("should compute correct cost with no fee", () => {
    // Pool: 170,000 LORDS / 150,000 tokens
    // Buy 14,890 tokens -> expect 18,736 LORDS cost
    const cost = getOutputPrice(0n, 1n, 14_890n, 170_000n, 150_000n);
    expect(cost).toBe(18_736n);
  });

  it("should compute correct cost with 0.3% fee", () => {
    // Pool: 170,000 LORDS / 150,000 tokens, 0.3% fee
    // Buy 14,890 tokens -> expect 18,792 LORDS cost
    const cost = getOutputPrice(FEE_NUM, FEE_DENOM, 14_890n, 170_000n, 150_000n);
    expect(cost).toBe(18_792n);
  });

  it("should throw when output exceeds reserve", () => {
    expect(() => getOutputPrice(FEE_NUM, FEE_DENOM, 150_001n, 170_000n, 150_000n)).toThrow(
      "output exceeds reserve",
    );
  });

  it("should round up to favor the pool", () => {
    // Exact: 100 * 1 / (100 - 1) = 1.0101... -> rounds to 2
    const cost = getOutputPrice(0n, 1n, 1n, 100n, 100n);
    expect(cost).toBe(2n);
  });
});

describe("quote", () => {
  it("should compute proportional quote", () => {
    // Pool 1:10 ratio. Given 2 of token A, should need 20 of token B.
    const result = quote(2n, 1n, 10n);
    expect(result).toBe(20n);
  });
});

describe("computeAddLiquidity", () => {
  it("should return desired amounts for first provider", () => {
    const { lordsUsed, tokenUsed } = computeAddLiquidity(1000n, 5000n, 0n, 0n);
    expect(lordsUsed).toBe(1000n);
    expect(tokenUsed).toBe(5000n);
  });

  it("should compute proportional amounts", () => {
    // Pool: 100 LORDS / 500 tokens (1:5 ratio)
    // Adding 50 LORDS -> need 250 tokens
    const { lordsUsed, tokenUsed } = computeAddLiquidity(50n, 300n, 100n, 500n);
    expect(lordsUsed).toBe(50n);
    expect(tokenUsed).toBe(250n);
  });

  it("should reduce lords when token is the constraint", () => {
    // Pool: 100 LORDS / 500 tokens (1:5 ratio)
    // Adding 200 tokens -> only need 40 LORDS
    const { lordsUsed, tokenUsed } = computeAddLiquidity(50n, 200n, 100n, 500n);
    expect(lordsUsed).toBe(40n);
    expect(tokenUsed).toBe(200n);
  });
});

describe("computeLpMint", () => {
  it("should return lords amount for first mint", () => {
    const lp = computeLpMint(1000n, 0n, 0n);
    expect(lp).toBe(1000n);
  });

  it("should compute proportional mint for subsequent deposits", () => {
    // Pool: 100 LORDS, 50 LP outstanding. Adding 50 LORDS -> 25 LP.
    const lp = computeLpMint(50n, 100n, 50n);
    expect(lp).toBe(25n);
  });
});

describe("computeLpBurn", () => {
  it("should compute correct payouts", () => {
    // Pool: 200 LORDS / 1000 tokens, 100 LP total. Burn 25 LP -> 50 LORDS + 250 tokens.
    const { lordsOut, tokenOut } = computeLpBurn(25n, 200n, 1000n, 100n);
    expect(lordsOut).toBe(50n);
    expect(tokenOut).toBe(250n);
  });

  it("should throw when lp exceeds supply", () => {
    expect(() => computeLpBurn(101n, 200n, 1000n, 100n)).toThrow("lp amount exceeds supply");
  });

  it("should throw on zero lp amount", () => {
    expect(() => computeLpBurn(0n, 200n, 1000n, 100n)).toThrow("insufficient lp amount");
  });
});

describe("constant product invariant", () => {
  it("should maintain k after sell (k only increases with fees)", () => {
    const lordsReserve = 170_000n;
    const tokenReserve = 150_000n;
    const sellAmount = 17_500n;

    const lordsOut = getInputPrice(FEE_NUM, FEE_DENOM, sellAmount, tokenReserve, lordsReserve);

    const newLords = lordsReserve - lordsOut;
    const newTokens = tokenReserve + sellAmount;
    const initialK = lordsReserve * tokenReserve;
    const finalK = newLords * newTokens;

    expect(finalK).toBeGreaterThanOrEqual(initialK);
  });

  it("should maintain k after buy (k only increases with fees)", () => {
    const lordsReserve = 170_000n;
    const tokenReserve = 150_000n;
    const buyAmount = 14_890n;

    const lordsCost = getOutputPrice(FEE_NUM, FEE_DENOM, buyAmount, lordsReserve, tokenReserve);

    const newLords = lordsReserve + lordsCost;
    const newTokens = tokenReserve - buyAmount;
    const initialK = lordsReserve * tokenReserve;
    const finalK = newLords * newTokens;

    expect(finalK).toBeGreaterThanOrEqual(initialK);
  });
});

describe("price impact", () => {
  it("should return 0 for zero amounts", () => {
    expect(computePriceImpact(0n, 100n, 100n, 0n, 1n)).toBe(0);
  });

  it("should return higher impact for larger trades", () => {
    const smallImpact = computePriceImpact(100n, 100_000n, 100_000n, 0n, 1n);
    const largeImpact = computePriceImpact(10_000n, 100_000n, 100_000n, 0n, 1n);
    expect(largeImpact).toBeGreaterThan(smallImpact);
  });

  it("should be non-negative", () => {
    const impact = computePriceImpact(1_000n, 100_000n, 100_000n, FEE_NUM, FEE_DENOM);
    expect(impact).toBeGreaterThanOrEqual(0);
  });
});

describe("minimum received", () => {
  it("should apply slippage tolerance", () => {
    // 1000 tokens with 50 bps (0.5%) slippage -> 995
    const min = computeMinimumReceived(1000n, 50n);
    expect(min).toBe(995n);
  });

  it("should return full amount with zero slippage", () => {
    expect(computeMinimumReceived(1000n, 0n)).toBe(1000n);
  });
});

describe("spot price", () => {
  it("should compute correct spot price", () => {
    expect(computeSpotPrice(200n, 100n)).toBe(2.0);
  });

  it("should return 0 for zero token reserve", () => {
    expect(computeSpotPrice(100n, 0n)).toBe(0);
  });
});
