import type { Pool } from "@/services/amm";
import { findResourceIdByTrait } from "@bibliothecadao/types";

import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import type { TokenOption } from "./amm-token-input";

interface DirectAmmSwapRoute {
  isLordsInput: boolean;
  kind: "direct";
  pool: Pool;
}

interface RoutedAmmSwapRoute {
  inputPool: Pool;
  kind: "routed";
  outputPool: Pool;
}

type AmmSwapRoute = DirectAmmSwapRoute | RoutedAmmSwapRoute;

interface AmmFeeBreakdown {
  lpFeePercent: number;
  protocolFeePercent: number;
  totalFeePercent: number;
}

interface OrderAmmPoolsOptions {
  lordsAddress: string;
  orderBy: AmmPoolOrder;
  marketCapByTokenAddress: Map<string, bigint | null>;
}

export type AmmPoolOrder = "mcap" | "resourceIds" | "tvl";

const LP_FEE_SHARE = 2 / 3;
const PROTOCOL_FEE_SHARE = 1 / 3;

export function buildAmmTokenOptions(pools: Pool[], lordsAddress: string): TokenOption[] {
  return [
    {
      address: lordsAddress,
      name: "LORDS",
      shortLabel: "LORDS",
      iconResource: "Lords",
    },
    ...pools.map((pool) => buildAmmTokenOption(pool, lordsAddress)),
  ];
}

export function resolveAmmPoolName(tokenAddress: string): string {
  return resolveAmmAssetPresentation(tokenAddress, "").displayName;
}

export function resolveAmmTokenName(tokenAddress: string, lordsAddress: string): string {
  return resolveAmmAssetPresentation(tokenAddress, lordsAddress).displayName;
}

export function resolveAmmFeeBreakdown(pool: Pick<Pool, "feeDenom" | "feeNum"> | null | undefined): AmmFeeBreakdown {
  const totalFeePercent = resolveTotalFeePercent(pool);

  return {
    totalFeePercent,
    lpFeePercent: totalFeePercent * LP_FEE_SHARE,
    protocolFeePercent: totalFeePercent * PROTOCOL_FEE_SHARE,
  };
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

export function orderAmmPools(pools: Pool[], options: OrderAmmPoolsOptions): Pool[] {
  return [...pools].sort((leftPool, rightPool) => compareAmmPools(leftPool, rightPool, options));
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

function buildAmmTokenOption(pool: Pool, lordsAddress: string): TokenOption {
  const assetPresentation = resolveAmmAssetPresentation(pool.tokenAddress, lordsAddress);

  return {
    address: pool.tokenAddress,
    name: assetPresentation.displayName,
    shortLabel: assetPresentation.shortLabel,
    iconResource: assetPresentation.iconResource,
  };
}

function compareAmmPools(leftPool: Pool, rightPool: Pool, options: OrderAmmPoolsOptions): number {
  if (options.orderBy === "mcap") {
    return (
      compareBigIntDescending(
        options.marketCapByTokenAddress.get(leftPool.tokenAddress) ?? null,
        options.marketCapByTokenAddress.get(rightPool.tokenAddress) ?? null,
      ) ||
      compareBigIntDescending(resolvePoolTvl(leftPool), resolvePoolTvl(rightPool)) ||
      compareResourceIdAscending(leftPool, rightPool, options.lordsAddress) ||
      compareTokenAddressAscending(leftPool, rightPool)
    );
  }

  if (options.orderBy === "tvl") {
    return (
      compareBigIntDescending(resolvePoolTvl(leftPool), resolvePoolTvl(rightPool)) ||
      compareResourceIdAscending(leftPool, rightPool, options.lordsAddress) ||
      compareTokenAddressAscending(leftPool, rightPool)
    );
  }

  return (
    compareResourceIdAscending(leftPool, rightPool, options.lordsAddress) ||
    compareBigIntDescending(resolvePoolTvl(leftPool), resolvePoolTvl(rightPool)) ||
    compareTokenAddressAscending(leftPool, rightPool)
  );
}

function compareResourceIdAscending(leftPool: Pool, rightPool: Pool, lordsAddress: string): number {
  return (
    resolveAmmPoolResourceId(leftPool.tokenAddress, lordsAddress) -
    resolveAmmPoolResourceId(rightPool.tokenAddress, lordsAddress)
  );
}

function resolveAmmPoolResourceId(tokenAddress: string, lordsAddress: string): number {
  const assetPresentation = resolveAmmAssetPresentation(tokenAddress, lordsAddress);
  return assetPresentation.isLords
    ? Number.MAX_SAFE_INTEGER
    : (findResourceIdByTrait(assetPresentation.displayName) ?? Number.MAX_SAFE_INTEGER);
}

function resolvePoolTvl(pool: Pick<Pool, "lordsReserve">): bigint {
  return pool.lordsReserve * 2n;
}

function compareBigIntDescending(leftValue: bigint | null, rightValue: bigint | null): number {
  if (leftValue === rightValue) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  return leftValue > rightValue ? -1 : 1;
}

function compareTokenAddressAscending(leftPool: Pool, rightPool: Pool): number {
  return leftPool.tokenAddress.localeCompare(rightPool.tokenAddress);
}

function resolveTotalFeePercent(pool: Pick<Pool, "feeDenom" | "feeNum"> | null | undefined): number {
  if (!pool || pool.feeDenom <= 0n) {
    return 0;
  }

  return (Number(pool.feeNum) / Number(pool.feeDenom)) * 100;
}
