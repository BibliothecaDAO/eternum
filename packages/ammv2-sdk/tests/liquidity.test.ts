import { describe, expect, it } from "vitest";
import { MINIMUM_LIQUIDITY } from "../src/constants";
import { computeAddLiquidity, computeInitialLpMint } from "../src/utils/liquidity";

describe("AMMv2 liquidity helpers", () => {
  it("keeps both user-specified amounts when initializing an empty pool", () => {
    expect(computeAddLiquidity(2_000n, 3_000n, 0n, 0n)).toEqual({
      amountAUsed: 2_000n,
      amountBUsed: 3_000n,
    });
  });

  it("matches the pair contract's initial LP mint formula", () => {
    expect(computeInitialLpMint(4_000n, 9_000n)).toBe(6_000n - MINIMUM_LIQUIDITY);
  });

  it("rejects initial liquidity that cannot clear the locked minimum", () => {
    expect(() => computeInitialLpMint(1_000n, 1_000n)).toThrow("insufficient initial liquidity");
  });
});
