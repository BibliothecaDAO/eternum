export interface PairSummary {
  pairAddress: string;
  factoryAddress: string;
  token0Address: string;
  token1Address: string;
  lpTokenAddress: string;
  reserve0: bigint;
  reserve1: bigint;
  totalLpSupply: bigint;
  feeAmount: bigint;
  feeTo: string;
}

export interface PairSwapEvent {
  pairAddress: string;
  txHash: string;
  initiatorAddress: string;
  callerAddress: string;
  recipientAddress: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  feeAmount: bigint;
  timestamp: number;
}

export interface PairLiquidityEvent {
  pairAddress: string;
  txHash: string;
  providerAddress: string;
  eventType: "add" | "remove";
  amount0: bigint;
  amount1: bigint;
  lpAmount: bigint;
  timestamp: number;
}

export interface PriceCandle {
  pairAddress: string;
  interval: CandleInterval;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume0: bigint;
  volume1: bigint;
  tradeCount: number;
}

export interface PairStats {
  pairAddress: string;
  reserve0: bigint;
  reserve1: bigint;
  totalLpSupply: bigint;
  feeAmount: bigint;
  feeTo: string;
  spotPriceToken1PerToken0: number;
  spotPriceToken0PerToken1: number;
  volume0_24h: bigint;
  volume1_24h: bigint;
  lpFees0_24h: bigint;
  lpFees1_24h: bigint;
  swapCount24h: number;
  resourceTokenSupply: bigint | null;
  lpHolderCount: number;
}

export interface UserPairPosition {
  pairAddress: string;
  factoryAddress: string;
  token0Address: string;
  token1Address: string;
  lpTokenAddress: string;
  lpBalance: bigint;
  totalLpSupply: bigint;
  poolShare: number;
  amount0: bigint;
  amount1: bigint;
}

export interface PathQuote {
  path: string[];
  pairAddresses: string[];
  amounts: bigint[];
  amountIn: bigint;
  amountOut: bigint;
}

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

export interface TimeRangeOpts {
  from?: number;
  to?: number;
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
