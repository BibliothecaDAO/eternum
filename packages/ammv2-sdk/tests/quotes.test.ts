import { describe, expect, it } from "vitest";
import { buildPairsByTokenPair, getAmountIn, getAmountOut, quoteExactIn, quoteExactOut } from "../src/utils/math";

const PAIRS = buildPairsByTokenPair([
  {
    pairAddress: "0xpair01",
    factoryAddress: "0xfactory",
    token0Address: "0x1",
    token1Address: "0x2",
    lpTokenAddress: "0xpair01",
    reserve0: 20_000n,
    reserve1: 40_000n,
    totalLpSupply: 10_000n,
    feeAmount: 997n,
    feeTo: "0xfee",
  },
  {
    pairAddress: "0xpair12",
    factoryAddress: "0xfactory",
    token0Address: "0x2",
    token1Address: "0x3",
    lpTokenAddress: "0xpair12",
    reserve0: 40_000n,
    reserve1: 8_000n,
    totalLpSupply: 12_000n,
    feeAmount: 997n,
    feeTo: "0xfee",
  },
]);

describe("AMMv2 quote helpers", () => {
  it("computes direct exact-in amounts", () => {
    const amountOut = getAmountOut(2_000n, 20_000n, 40_000n, 997n);
    const quote = quoteExactIn(["0x1", "0x2"], 2_000n, PAIRS);

    expect(quote.amountOut).toBe(amountOut);
    expect(quote.amounts).toEqual([2_000n, amountOut]);
    expect(quote.pairAddresses).toEqual(["0xpair01"]);
  });

  it("computes direct exact-out amounts", () => {
    const amountIn = getAmountIn(2_000n, 20_000n, 40_000n, 997n);
    const quote = quoteExactOut(["0x1", "0x2"], 2_000n, PAIRS);

    expect(quote.amountIn).toBe(amountIn);
    expect(quote.amounts).toEqual([amountIn, 2_000n]);
    expect(quote.pairAddresses).toEqual(["0xpair01"]);
  });

  it("computes two-hop exact-in routes", () => {
    const firstHopOut = getAmountOut(2_000n, 20_000n, 40_000n, 997n);
    const secondHopOut = getAmountOut(firstHopOut, 40_000n, 8_000n, 997n);
    const quote = quoteExactIn(["0x1", "0x2", "0x3"], 2_000n, PAIRS);

    expect(quote.amountOut).toBe(secondHopOut);
    expect(quote.amounts).toEqual([2_000n, firstHopOut, secondHopOut]);
    expect(quote.pairAddresses).toEqual(["0xpair01", "0xpair12"]);
  });

  it("computes two-hop exact-out routes", () => {
    const secondHopIn = getAmountIn(500n, 40_000n, 8_000n, 997n);
    const firstHopIn = getAmountIn(secondHopIn, 20_000n, 40_000n, 997n);
    const quote = quoteExactOut(["0x1", "0x2", "0x3"], 500n, PAIRS);

    expect(quote.amountIn).toBe(firstHopIn);
    expect(quote.amounts).toEqual([firstHopIn, secondHopIn, 500n]);
    expect(quote.pairAddresses).toEqual(["0xpair01", "0xpair12"]);
  });
});
