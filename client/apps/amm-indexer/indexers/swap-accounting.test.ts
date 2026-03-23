// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildSwapMutations } from "./swap-accounting";

const LORDS_ADDRESS = "0x1";

describe("buildSwapMutations", () => {
  it("builds one pool mutation for a direct swap", () => {
    const mutations = buildSwapMutations({
      amountIn: 500n,
      amountOut: 450n,
      lordsAddress: LORDS_ADDRESS,
      poolsByToken: {
        "0x2": {
          feeNum: 3n,
          feeDenom: 1000n,
          lordsReserve: 10_000n,
          protocolFeeNum: 1n,
          protocolFeeDenom: 100n,
          tokenAddress: "0x2",
          tokenReserve: 20_000n,
        },
      },
      protocolFee: 50n,
      tokenIn: LORDS_ADDRESS,
      tokenOut: "0x2",
    });

    expect(mutations).toEqual([
      expect.objectContaining({
        amountIn: 500n,
        amountOut: 450n,
        protocolFee: 50n,
        tokenAddress: "0x2",
        tokenIn: LORDS_ADDRESS,
        tokenOut: "0x2",
        nextLordsReserve: 10_500n,
        nextTokenReserve: 19_500n,
      }),
    ]);
  });

  it("decomposes a token-to-token route into two pool mutations", () => {
    const mutations = buildSwapMutations({
      amountIn: 500n,
      amountOut: 1590n,
      lordsAddress: LORDS_ADDRESS,
      poolsByToken: {
        "0x2": {
          feeNum: 3n,
          feeDenom: 1000n,
          lordsReserve: 10_000n,
          protocolFeeNum: 1n,
          protocolFeeDenom: 100n,
          tokenAddress: "0x2",
          tokenReserve: 5_000n,
        },
        "0x3": {
          feeNum: 3n,
          feeDenom: 1000n,
          lordsReserve: 8_000n,
          protocolFeeNum: 1n,
          protocolFeeDenom: 100n,
          tokenAddress: "0x3",
          tokenReserve: 16_000n,
        },
      },
      protocolFee: 0n,
      tokenIn: "0x2",
      tokenOut: "0x3",
    });

    expect(mutations).toHaveLength(2);
    expect(mutations[0]).toEqual(
      expect.objectContaining({
        tokenAddress: "0x2",
        tokenIn: "0x2",
        tokenOut: LORDS_ADDRESS,
      }),
    );
    expect(mutations[1]).toEqual(
      expect.objectContaining({
        tokenAddress: "0x3",
        tokenIn: LORDS_ADDRESS,
        tokenOut: "0x3",
      }),
    );
    expect(mutations[0].nextTokenReserve).toBe(5_500n);
    expect(mutations[1].nextLordsReserve).toBeGreaterThan(8_000n);
    expect(mutations[1].nextTokenReserve).toBeLessThan(16_000n);
    expect(mutations[1].amountOut).toBe(1590n);
  });
});
