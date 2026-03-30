import type {
  PairLiquidityEvent,
  PairStats,
  PairSummary,
  PairSwapEvent,
  PriceCandle,
  UserPairPosition,
} from "../types";

type ApiEnvelope<T> = { data: T };

export type RawPairSummary = {
  pairAddress: string;
  factoryAddress: string;
  token0Address: string;
  token1Address: string;
  lpTokenAddress: string;
  reserve0: string | number;
  reserve1: string | number;
  totalLpSupply: string | number;
  feeAmount: string | number;
  feeTo: string;
};

export type RawPairSwapEvent = {
  pairAddress: string;
  txHash: string;
  initiatorAddress: string;
  callerAddress: string;
  recipientAddress: string;
  amount0In: string | number;
  amount1In: string | number;
  amount0Out: string | number;
  amount1Out: string | number;
  feeAmount: string | number;
  blockTimestamp?: string;
  timestamp?: string | number;
};

export type RawPairLiquidityEvent = {
  pairAddress: string;
  txHash: string;
  providerAddress: string;
  eventType: "add" | "remove";
  amount0: string | number;
  amount1: string | number;
  lpAmount: string | number;
  blockTimestamp?: string;
  timestamp?: string | number;
};

export type RawPriceCandle = {
  pairAddress: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume0: string | number;
  volume1: string | number;
  tradeCount: number;
};

export type RawPairStats = {
  pairAddress: string;
  reserve0: string | number;
  reserve1: string | number;
  totalLpSupply: string | number;
  feeAmount: string | number;
  feeTo: string;
  spotPriceToken1PerToken0: number;
  spotPriceToken0PerToken1: number;
  volume0_24h: string | number;
  volume1_24h: string | number;
  lpFees0_24h: string | number;
  lpFees1_24h: string | number;
  swapCount24h: number;
  resourceTokenSupply: string | number | null;
  lpHolderCount: number;
};

export type RawUserPairPosition = {
  pairAddress: string;
  factoryAddress: string;
  token0Address: string;
  token1Address: string;
  lpTokenAddress: string;
  lpBalance: string | number;
  totalLpSupply: string | number;
  poolShare: number;
  amount0: string | number;
  amount1: string | number;
};

const toBigInt = (value: string | number | bigint): bigint => BigInt(value);
const toNumber = (value: string | number): number => Number(value);
const toNullableBigInt = (value: string | number | bigint | null | undefined): bigint | null =>
  value === null || value === undefined ? null : BigInt(value);

const toUnixSeconds = (value: string | number): number =>
  typeof value === "number" ? value : Math.floor(new Date(value).getTime() / 1000);

export function unwrapApiData<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

export function decodePairSummary(raw: RawPairSummary): PairSummary {
  return {
    pairAddress: raw.pairAddress,
    factoryAddress: raw.factoryAddress,
    token0Address: raw.token0Address,
    token1Address: raw.token1Address,
    lpTokenAddress: raw.lpTokenAddress,
    reserve0: toBigInt(raw.reserve0),
    reserve1: toBigInt(raw.reserve1),
    totalLpSupply: toBigInt(raw.totalLpSupply),
    feeAmount: toBigInt(raw.feeAmount),
    feeTo: raw.feeTo,
  };
}

export function decodePairSwapEvent(raw: RawPairSwapEvent): PairSwapEvent {
  return {
    pairAddress: raw.pairAddress,
    txHash: raw.txHash,
    initiatorAddress: raw.initiatorAddress,
    callerAddress: raw.callerAddress,
    recipientAddress: raw.recipientAddress,
    amount0In: toBigInt(raw.amount0In),
    amount1In: toBigInt(raw.amount1In),
    amount0Out: toBigInt(raw.amount0Out),
    amount1Out: toBigInt(raw.amount1Out),
    feeAmount: toBigInt(raw.feeAmount),
    timestamp: toUnixSeconds(raw.timestamp ?? raw.blockTimestamp ?? 0),
  };
}

export function decodePairLiquidityEvent(raw: RawPairLiquidityEvent): PairLiquidityEvent {
  return {
    pairAddress: raw.pairAddress,
    txHash: raw.txHash,
    providerAddress: raw.providerAddress,
    eventType: raw.eventType,
    amount0: toBigInt(raw.amount0),
    amount1: toBigInt(raw.amount1),
    lpAmount: toBigInt(raw.lpAmount),
    timestamp: toUnixSeconds(raw.timestamp ?? raw.blockTimestamp ?? 0),
  };
}

export function decodePriceCandle(raw: RawPriceCandle): PriceCandle {
  return {
    pairAddress: raw.pairAddress,
    interval: raw.interval as PriceCandle["interval"],
    openTime: toUnixSeconds(raw.openTime),
    closeTime: toUnixSeconds(raw.closeTime),
    open: toNumber(raw.open),
    high: toNumber(raw.high),
    low: toNumber(raw.low),
    close: toNumber(raw.close),
    volume0: toBigInt(raw.volume0),
    volume1: toBigInt(raw.volume1),
    tradeCount: raw.tradeCount,
  };
}

export function decodePairStats(raw: RawPairStats): PairStats {
  return {
    pairAddress: raw.pairAddress,
    reserve0: toBigInt(raw.reserve0),
    reserve1: toBigInt(raw.reserve1),
    totalLpSupply: toBigInt(raw.totalLpSupply),
    feeAmount: toBigInt(raw.feeAmount),
    feeTo: raw.feeTo,
    spotPriceToken1PerToken0: raw.spotPriceToken1PerToken0,
    spotPriceToken0PerToken1: raw.spotPriceToken0PerToken1,
    volume0_24h: toBigInt(raw.volume0_24h),
    volume1_24h: toBigInt(raw.volume1_24h),
    lpFees0_24h: toBigInt(raw.lpFees0_24h),
    lpFees1_24h: toBigInt(raw.lpFees1_24h),
    swapCount24h: raw.swapCount24h,
    resourceTokenSupply: toNullableBigInt(raw.resourceTokenSupply),
    lpHolderCount: raw.lpHolderCount,
  };
}

export function decodeUserPairPosition(raw: RawUserPairPosition): UserPairPosition {
  return {
    pairAddress: raw.pairAddress,
    factoryAddress: raw.factoryAddress,
    token0Address: raw.token0Address,
    token1Address: raw.token1Address,
    lpTokenAddress: raw.lpTokenAddress,
    lpBalance: toBigInt(raw.lpBalance),
    totalLpSupply: toBigInt(raw.totalLpSupply),
    poolShare: raw.poolShare,
    amount0: toBigInt(raw.amount0),
    amount1: toBigInt(raw.amount1),
  };
}
