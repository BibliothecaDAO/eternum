// @vitest-environment node

import type { Pool } from "@/services/amm";
import { describe, expect, it } from "vitest";

import {
  buildAmmTokenOptions,
  orderAmmPools,
  resolveAmmFeeBreakdown,
  resolveAmmPoolName,
  resolveAmmSwapRoute,
  resolveAmmTokenName,
  resolveSelectedAmmPool,
} from "./amm-model";

const LORDS_ADDRESS = "0xlords";
const STONE_ADDRESS = "0x439a1c010e3e1bb2d43d43411000893c0042bd88f6c701611a0ea914d426da4";
const COAL_ADDRESS = "0xce635e3f241b0ae78c46a929d84a9101910188f9c4024eaa7559556503c31a";
const WOOD_ADDRESS = "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4";
const DONKEY_ADDRESS = "0x264be95a4a2ace20add68cb321acdccd2f9f8440ee1c7abd85da44ddab01085";
const KNIGHT_ADDRESS = "0xac965f9e67164723c16735a9da8dbc9eb8e43b1bd0323591e87c056badf606";
const WHEAT_ADDRESS = "0x57a3f1ee475e072ce3be41785c0e889b7295d7a0dcc22b992c5b9408dbeb280";

function createPool(tokenAddress: string, overrides?: Partial<Pool>): Pool {
  return {
    pairAddress: `${tokenAddress}-pair`,
    tokenAddress,
    lpTokenAddress: `${tokenAddress}-lp`,
    lordsReserve: 1000n,
    tokenReserve: 500n,
    totalLpSupply: 250n,
    feeAmount: 997n,
    feeNum: 3n,
    feeDenom: 1000n,
    feeTo: "0x0",
    ...overrides,
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

  it("splits the pool fee into LP and protocol shares", () => {
    const feeBreakdown = resolveAmmFeeBreakdown(createPool("0x2"));

    expect(feeBreakdown.totalFeePercent).toBeCloseTo(0.3);
    expect(feeBreakdown.lpFeePercent).toBeCloseTo(0.2);
    expect(feeBreakdown.protocolFeePercent).toBeCloseTo(0.1);
  });

  it("orders AMM pools by market cap", () => {
    const stonePool = createPool(STONE_ADDRESS);
    const coalPool = createPool(COAL_ADDRESS);
    const woodPool = createPool(WOOD_ADDRESS);

    const orderedPools = orderAmmPools([woodPool, stonePool, coalPool], {
      lordsAddress: LORDS_ADDRESS,
      orderBy: "mcap",
      marketCapByTokenAddress: new Map([
        [WOOD_ADDRESS, 5n],
        [STONE_ADDRESS, 20n],
        [COAL_ADDRESS, 10n],
      ]),
    });

    expect(orderedPools.map((pool) => pool.tokenAddress)).toEqual([STONE_ADDRESS, COAL_ADDRESS, WOOD_ADDRESS]);
  });

  it("orders AMM pools by resource id", () => {
    const orderedPools = orderAmmPools(
      [WOOD_ADDRESS, COAL_ADDRESS, STONE_ADDRESS].map((address) => createPool(address)),
      {
        lordsAddress: LORDS_ADDRESS,
        orderBy: "resourceIds",
        marketCapByTokenAddress: new Map(),
      },
    );

    expect(orderedPools.map((pool) => pool.tokenAddress)).toEqual([STONE_ADDRESS, COAL_ADDRESS, WOOD_ADDRESS]);
  });

  it("orders AMM pools by tvl", () => {
    const lowTvlPool = createPool(STONE_ADDRESS, { lordsReserve: 100n });
    const highTvlPool = createPool(COAL_ADDRESS, { lordsReserve: 400n });
    const midTvlPool = createPool(WOOD_ADDRESS, { lordsReserve: 250n });

    const orderedPools = orderAmmPools([lowTvlPool, highTvlPool, midTvlPool], {
      lordsAddress: LORDS_ADDRESS,
      orderBy: "tvl",
      marketCapByTokenAddress: new Map(),
    });

    expect(orderedPools.map((pool) => pool.tokenAddress)).toEqual([COAL_ADDRESS, WOOD_ADDRESS, STONE_ADDRESS]);
  });

  it("orders AMM pools by the requested default editorial sequence", () => {
    const orderedPools = orderAmmPools(
      [KNIGHT_ADDRESS, DONKEY_ADDRESS, WOOD_ADDRESS, WHEAT_ADDRESS].map((address) => createPool(address)),
      {
        lordsAddress: LORDS_ADDRESS,
        orderBy: "default" as unknown as "mcap" | "resourceIds" | "tvl",
        marketCapByTokenAddress: new Map(),
      },
    );

    expect(orderedPools.map((pool) => pool.tokenAddress)).toEqual([
      WOOD_ADDRESS,
      DONKEY_ADDRESS,
      WHEAT_ADDRESS,
      KNIGHT_ADDRESS,
    ]);
  });

  it("places unknown pools after the known default editorial sequence", () => {
    const UNKNOWN_ADDRESS = "0x999999999";
    const orderedPools = orderAmmPools([createPool(UNKNOWN_ADDRESS), createPool(DONKEY_ADDRESS)], {
      lordsAddress: LORDS_ADDRESS,
      orderBy: "default" as unknown as "mcap" | "resourceIds" | "tvl",
      marketCapByTokenAddress: new Map(),
    });

    expect(orderedPools.map((pool) => pool.tokenAddress)).toEqual([DONKEY_ADDRESS, UNKNOWN_ADDRESS]);
  });
});
