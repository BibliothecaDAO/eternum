// @vitest-environment node

import type { Pool } from "@/services/amm";
import { describe, expect, it } from "vitest";

import {
  isPoolAwaitingInitialLiquidity,
  resolveAutoFilledTokenAmount,
  resolveLpTokensToMint,
  resolvePoolSharePercent,
} from "./amm-add-liquidity-model";

const TOKEN_UNIT = 10n ** 18n;

function createPool(overrides: Partial<Pool> = {}): Pool {
  return {
    pairAddress: "0xpair",
    tokenAddress: "0xtoken",
    lpTokenAddress: "0xpair",
    lordsReserve: 100n * TOKEN_UNIT,
    tokenReserve: 50n * TOKEN_UNIT,
    totalLpSupply: 10n * TOKEN_UNIT,
    feeAmount: 997n,
    feeNum: 3n,
    feeDenom: 1000n,
    feeTo: "0x0",
    ...overrides,
  };
}

describe("amm-add-liquidity-model", () => {
  it("treats zero-liquidity pairs as manually seeded pools", () => {
    const emptyPool = createPool({ lordsReserve: 0n, tokenReserve: 0n, totalLpSupply: 0n });

    expect(isPoolAwaitingInitialLiquidity(emptyPool)).toBe(true);
    expect(resolveAutoFilledTokenAmount(emptyPool, 12)).toBe(0);
  });

  it("auto-fills the second side when the pool already has liquidity", () => {
    const livePool = createPool();

    expect(resolveAutoFilledTokenAmount(livePool, 2)).toBe(1);
  });

  it("uses both entered amounts to preview the first LP mint", () => {
    const emptyPool = createPool({ lordsReserve: 0n, tokenReserve: 0n, totalLpSupply: 0n });

    expect(resolveLpTokensToMint(emptyPool, 2000, 2000)).toBe("1999.999999999999999");
    expect(resolvePoolSharePercent(emptyPool, 2000, 2000)).toBe(99.99);
  });
});
