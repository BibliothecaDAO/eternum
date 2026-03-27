import { describe, expect, it } from "vitest";

import { AmmClient } from "../src";
import { getInputPrice } from "../src/utils/math";

describe("AmmClient.quoteSwap", () => {
  it("subtracts protocol fees from the quoted output and minimum received", () => {
    const client = new AmmClient({
      ammAddress: "0xamm",
      lordsAddress: "0xlords",
      indexerUrl: "https://amm.example",
    });

    const quote = client.quoteSwap(
      {
        tokenAddress: "0x2",
        lpTokenAddress: "0x100",
        lordsReserve: 100_000n,
        tokenReserve: 100_000n,
        totalLpSupply: 1_000n,
        feeNum: 3n,
        feeDenom: 1000n,
        protocolFeeNum: 1n,
        protocolFeeDenom: 100n,
      },
      1_000n,
      true,
      50n,
    );

    const grossOutput = getInputPrice(3n, 1000n, 1_000n, 100_000n, 100_000n);
    const protocolFee = grossOutput / 100n;

    expect(quote.amountOut).toBe(grossOutput - protocolFee);
    expect(quote.minimumReceived).toBe(((grossOutput - protocolFee) * 9950n) / 10000n);
  });

  it("computes spotPriceAfter from the gross reserve depletion only once", () => {
    const client = new AmmClient({
      ammAddress: "0xamm",
      lordsAddress: "0xlords",
      indexerUrl: "https://amm.example",
    });

    const pool = {
      tokenAddress: "0x2",
      lpTokenAddress: "0x100",
      lordsReserve: 100_000n,
      tokenReserve: 100_000n,
      totalLpSupply: 1_000n,
      feeNum: 3n,
      feeDenom: 1000n,
      protocolFeeNum: 1n,
      protocolFeeDenom: 100n,
    };

    const quote = client.quoteSwap(pool, 1_000n, true, 50n);
    const grossOutput = getInputPrice(3n, 1000n, 1_000n, 100_000n, 100_000n);
    const expectedSpotPriceAfter = Number(pool.lordsReserve + 1_000n) / Number(pool.tokenReserve - grossOutput);

    expect(quote.spotPriceAfter).toBeCloseTo(expectedSpotPriceAfter, 12);
  });
});
