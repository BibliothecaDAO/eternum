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
    const options = buildAmmTokenOptions([createPool("0x2"), createPool("0x999999999")], LORDS_ADDRESS);

    expect(options).toEqual([
      { address: LORDS_ADDRESS, name: "LORDS" },
      { address: "0x2", name: "Wood" },
      { address: "0x999999999", name: "0x999999..." },
    ]);
  });

  it("resolves pool and token names for known and fallback addresses", () => {
    expect(resolveAmmPoolName("0x4")).toBe("Coal");
    expect(resolveAmmPoolName("0xabcdef123456")).toBe("0xabcdef...");
    expect(resolveAmmTokenName(LORDS_ADDRESS, LORDS_ADDRESS)).toBe("LORDS");
    expect(resolveAmmTokenName("0x3", LORDS_ADDRESS)).toBe("Stone");
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
