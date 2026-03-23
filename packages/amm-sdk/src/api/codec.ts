import type { LiquidityEvent, Pool, PoolStats, PriceCandle, SwapEvent, UserPosition } from "../types";

type ApiEnvelope<T> = { data: T };

export type RawPool = {
  tokenAddress: string;
  lpTokenAddress: string;
  lordsReserve: string | number;
  tokenReserve: string | number;
  totalLpSupply: string | number;
  lpFeeNum?: string | number;
  lpFeeDenom?: string | number;
  protocolFeeNum?: string | number;
  protocolFeeDenom?: string | number;
  feeNum?: string | number;
  feeDenom?: string | number;
};

export type RawSwapEvent = {
  txHash: string;
  user?: string;
  userAddress?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string | number;
  amountOut: string | number;
  protocolFee: string | number;
  timestamp?: string | number;
  blockTimestamp?: string;
};

export type RawLiquidityEvent = {
  txHash: string;
  provider?: string;
  providerAddress?: string;
  tokenAddress: string;
  lordsAmount: string | number;
  tokenAmount: string | number;
  lpAmount: string | number;
  type?: "add" | "remove";
  eventType?: "add" | "remove";
  timestamp?: string | number;
  blockTimestamp?: string;
};

export type RawPriceCandle = {
  timestamp?: string | number;
  openTime?: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
};

export type RawPoolStats = {
  tokenAddress: string;
  lordsReserve: string | number;
  tokenReserve: string | number;
  tvl?: string | number;
  tvlLords?: string | number;
  volume24h: string | number;
  fees24h: string | number;
  trades24h?: number;
  swapCount24h?: number;
  spotPrice?: number;
};

export type RawUserPosition = {
  tokenAddress: string;
  lpBalance: string | number;
  poolShare: number;
  lordsValue: string | number;
  tokenValue: string | number;
};

const toBigInt = (value: string | number | bigint): bigint => BigInt(value);
const toNumber = (value: string | number): number => Number(value);

const toUnixSeconds = (value: string | number): number =>
  typeof value === "number" ? value : Math.floor(new Date(value).getTime() / 1000);

export function unwrapApiData<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export function decodePool(raw: RawPool): Pool {
  return {
    tokenAddress: raw.tokenAddress,
    lpTokenAddress: raw.lpTokenAddress,
    lordsReserve: toBigInt(raw.lordsReserve),
    tokenReserve: toBigInt(raw.tokenReserve),
    totalLpSupply: toBigInt(raw.totalLpSupply),
    feeNum: toBigInt(raw.feeNum ?? raw.lpFeeNum ?? 0),
    feeDenom: toBigInt(raw.feeDenom ?? raw.lpFeeDenom ?? 0),
    protocolFeeNum: toBigInt(raw.protocolFeeNum ?? 0),
    protocolFeeDenom: toBigInt(raw.protocolFeeDenom ?? 0),
  };
}

export function decodeSwapEvent(raw: RawSwapEvent): SwapEvent {
  return {
    txHash: raw.txHash,
    user: raw.user ?? raw.userAddress ?? "",
    tokenIn: raw.tokenIn,
    tokenOut: raw.tokenOut,
    amountIn: toBigInt(raw.amountIn),
    amountOut: toBigInt(raw.amountOut),
    protocolFee: toBigInt(raw.protocolFee),
    timestamp: toUnixSeconds(raw.timestamp ?? raw.blockTimestamp ?? 0),
  };
}

export function decodeLiquidityEvent(raw: RawLiquidityEvent): LiquidityEvent {
  return {
    txHash: raw.txHash,
    provider: raw.provider ?? raw.providerAddress ?? "",
    tokenAddress: raw.tokenAddress,
    lordsAmount: toBigInt(raw.lordsAmount),
    tokenAmount: toBigInt(raw.tokenAmount),
    lpAmount: toBigInt(raw.lpAmount),
    type: raw.type ?? raw.eventType ?? "add",
    timestamp: toUnixSeconds(raw.timestamp ?? raw.blockTimestamp ?? 0),
  };
}

export function decodePriceCandle(raw: RawPriceCandle): PriceCandle {
  return {
    timestamp: toUnixSeconds(raw.timestamp ?? raw.openTime ?? 0),
    open: toNumber(raw.open),
    high: toNumber(raw.high),
    low: toNumber(raw.low),
    close: toNumber(raw.close),
    volume: toBigInt(raw.volume),
  };
}

export function decodePoolStats(raw: RawPoolStats): PoolStats {
  const lordsReserve = toBigInt(raw.lordsReserve);
  const tokenReserve = toBigInt(raw.tokenReserve);

  return {
    tokenAddress: raw.tokenAddress,
    tvlLords: toBigInt(raw.tvlLords ?? raw.tvl ?? 0),
    volume24h: toBigInt(raw.volume24h),
    fees24h: toBigInt(raw.fees24h),
    swapCount24h: raw.swapCount24h ?? raw.trades24h ?? 0,
    spotPrice: raw.spotPrice ?? (tokenReserve === 0n ? 0 : Number(lordsReserve) / Number(tokenReserve)),
  };
}

export function decodeUserPosition(raw: RawUserPosition): UserPosition {
  return {
    tokenAddress: raw.tokenAddress,
    lpBalance: toBigInt(raw.lpBalance),
    poolShare: raw.poolShare,
    lordsValue: toBigInt(raw.lordsValue),
    tokenValue: toBigInt(raw.tokenValue),
  };
}
