import type { Pool } from "@bibliothecadao/amm-sdk";

import type { TokenOption } from "./amm-token-input";

const TOKEN_NAMES: Record<string, string> = {
  "0x2": "Wood",
  "0x3": "Stone",
  "0x4": "Coal",
  "0x5": "Copper",
  "0x6": "Ironwood",
};

export interface DirectAmmSwapRoute {
  isLordsInput: boolean;
  kind: "direct";
  pool: Pool;
}

export interface RoutedAmmSwapRoute {
  inputPool: Pool;
  kind: "routed";
  outputPool: Pool;
}

export type AmmSwapRoute = DirectAmmSwapRoute | RoutedAmmSwapRoute;

export function buildAmmTokenOptions(pools: Pool[], lordsAddress: string): TokenOption[] {
  return [
    { address: lordsAddress, name: "LORDS" },
    ...pools.map((pool) => ({
      address: pool.tokenAddress,
      name: resolveAmmTokenName(pool.tokenAddress, lordsAddress),
    })),
  ];
}

export function resolveAmmPoolName(tokenAddress: string): string {
  return TOKEN_NAMES[tokenAddress] ?? `${tokenAddress.slice(0, 8)}...`;
}

export function resolveAmmTokenName(tokenAddress: string, lordsAddress: string): string {
  return tokenAddress === lordsAddress ? "LORDS" : resolveAmmPoolName(tokenAddress);
}

export function resolveSelectedAmmPool(pools: Pool[], selectedPool: string | null): Pool | null {
  if (pools.length === 0) {
    return null;
  }

  if (!selectedPool) {
    return pools[0];
  }

  return pools.find((pool) => pool.tokenAddress === selectedPool) ?? pools[0];
}

export function resolveAmmSwapRoute(
  pools: Pool[],
  lordsAddress: string,
  payToken: string,
  receiveToken: string,
): AmmSwapRoute | null {
  if (!payToken || !receiveToken || payToken === receiveToken) {
    return null;
  }

  if (payToken === lordsAddress) {
    const pool = pools.find((candidate) => candidate.tokenAddress === receiveToken);
    return pool ? { kind: "direct", pool, isLordsInput: true } : null;
  }

  if (receiveToken === lordsAddress) {
    const pool = pools.find((candidate) => candidate.tokenAddress === payToken);
    return pool ? { kind: "direct", pool, isLordsInput: false } : null;
  }

  const inputPool = pools.find((candidate) => candidate.tokenAddress === payToken);
  const outputPool = pools.find((candidate) => candidate.tokenAddress === receiveToken);

  return inputPool && outputPool ? { kind: "routed", inputPool, outputPool } : null;
}
