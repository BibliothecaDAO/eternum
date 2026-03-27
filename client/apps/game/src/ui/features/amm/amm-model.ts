import type { Pool } from "@/services/amm";

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

function resolveTotalFeePercent(pool: Pick<Pool, "feeDenom" | "feeNum"> | null | undefined): number {
  if (!pool || pool.feeDenom <= 0n) {
    return 0;
  }

  return (Number(pool.feeNum) / Number(pool.feeDenom)) * 100;
}
