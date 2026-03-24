// @vitest-environment node

import type { Pool } from "@bibliothecadao/amm-sdk";
import { describe, expect, it } from "vitest";

import {
  buildAmmTokenOptions,
  resolveAmmPoolName,
  resolveAmmSwapRoute,
  resolveAmmTokenName,
  resolveSelectedAmmPool,
} from "./amm-model";

const LORDS_ADDRESS = "0xlords";

function createPool(tokenAddress: string): Pool {
  return {
    tokenAddress,
    lpTokenAddress: `${tokenAddress}-lp`,
    lordsReserve: 1000n,
    tokenReserve: 500n,
    totalLpSupply: 250n,
    feeNum: 3n,
    feeDenom: 1000n,
    protocolFeeNum: 1n,
    protocolFeeDenom: 1000n,
  };
}

describe("amm-model", () => {
  it("builds token options with LORDS first and resolved pool names after it", () => {
    const options = buildAmmTokenOptions(
      [createPool("0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4"), createPool("0x999999999")],
      LORDS_ADDRESS,
    );

    expect(options).toEqual([
      { address: LORDS_ADDRESS, name: "LORDS", shortLabel: "LORDS", iconResource: "Lords" },
      {
        address: "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4",
        name: "Wood",
        shortLabel: "WOOD",
        iconResource: "Wood",
      },
      { address: "0x999999999", name: "0x999999...", shortLabel: "0x999999", iconResource: null },
    ]);
  });

  it("resolves pool and token names for known and fallback addresses", () => {
    expect(resolveAmmPoolName("0xce635e3f241b0ae78c46a929d84a9101910188f9c4024eaa7559556503c31a")).toBe("Coal");
    expect(resolveAmmPoolName("0x0695b08ecdfdd828c2e6267da62f59e6d7543e690ef56a484df25c8566b332a5")).toBe(
      "Ancient Fragment",
    );
    expect(resolveAmmPoolName("0xabcdef123456")).toBe("0xabcdef...");
    expect(resolveAmmTokenName(LORDS_ADDRESS, LORDS_ADDRESS)).toBe("LORDS");
    expect(
      resolveAmmTokenName("0x439a1c010e3e1bb2d43d43411000893c0042bd88f6c701611a0ea914d426da4", LORDS_ADDRESS),
    ).toBe("Stone");
  });

  it("returns the first pool when no pool is selected or the selection is unknown", () => {
    const pools = [createPool("0x2"), createPool("0x3")];

    expect(resolveSelectedAmmPool([], null)).toBeNull();
    expect(resolveSelectedAmmPool(pools, null)).toBe(pools[0]);
    expect(resolveSelectedAmmPool(pools, "0xdoes-not-exist")).toBe(pools[0]);
    expect(resolveSelectedAmmPool(pools, "0x3")).toBe(pools[1]);
  });

  it("returns null when a swap route is incomplete or loops to the same token", () => {
    const pools = [createPool("0x2")];

    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, "", "0x2")).toBeNull();
    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, "0x2", "")).toBeNull();
    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, "0x2", "0x2")).toBeNull();
  });

  it("resolves direct routes for LORDS-to-token and token-to-LORDS swaps", () => {
    const woodPool = createPool("0x2");
    const pools = [woodPool, createPool("0x3")];

    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, LORDS_ADDRESS, "0x2")).toEqual({
      kind: "direct",
      pool: woodPool,
      isLordsInput: true,
    });
    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, "0x2", LORDS_ADDRESS)).toEqual({
      kind: "direct",
      pool: woodPool,
      isLordsInput: false,
    });
  });

  it("resolves routed token-to-token swaps only when both pools exist", () => {
    const woodPool = createPool("0x2");
    const stonePool = createPool("0x3");
    const pools = [woodPool, stonePool];

    expect(resolveAmmSwapRoute(pools, LORDS_ADDRESS, "0x2", "0x3")).toEqual({
      kind: "routed",
      inputPool: woodPool,
      outputPool: stonePool,
    });
    expect(resolveAmmSwapRoute([woodPool], LORDS_ADDRESS, "0x2", "0x3")).toBeNull();
  });
});
