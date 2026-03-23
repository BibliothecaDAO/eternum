/** Represents an AMM liquidity pool. */
export interface Pool {
  /** Token contract address (the non-LORDS side of the pair). */
  tokenAddress: string;
  /** LP token contract address. */
  lpTokenAddress: string;
  /** LORDS reserve in the pool. */
  lordsReserve: bigint;
  /** Token reserve in the pool. */
  tokenReserve: bigint;
  /** Total supply of LP tokens. */
  totalLpSupply: bigint;
  /** LP fee numerator (e.g. 3 for 0.3%). */
  feeNum: bigint;
  /** LP fee denominator (e.g. 1000 for 0.3%). */
  feeDenom: bigint;
  /** Protocol fee numerator. */
  protocolFeeNum: bigint;
  /** Protocol fee denominator. */
  protocolFeeDenom: bigint;
}

/** A swap event from the AMM contract. */
export interface SwapEvent {
  /** Transaction hash. */
  txHash: string;
  /** User who performed the swap. */
  user: string;
  /** Address of the input token. */
  tokenIn: string;
  /** Address of the output token. */
  tokenOut: string;
  /** Amount of input token. */
  amountIn: bigint;
  /** Amount of output token. */
  amountOut: bigint;
  /** Protocol fee charged. */
  protocolFee: bigint;
  /** Block timestamp (unix seconds). */
  timestamp: number;
}

/** A liquidity add/remove event. */
export interface LiquidityEvent {
  /** Transaction hash. */
  txHash: string;
  /** Liquidity provider address. */
  provider: string;
  /** Token address (the pool). */
  tokenAddress: string;
  /** LORDS amount added or removed. */
  lordsAmount: bigint;
  /** Token amount added or removed. */
  tokenAmount: bigint;
  /** LP tokens minted (add) or burned (remove). */
  lpAmount: bigint;
  /** "add" or "remove". */
  type: "add" | "remove";
  /** Block timestamp (unix seconds). */
  timestamp: number;
}

/** OHLCV price candle. */
export interface PriceCandle {
  /** Candle open timestamp (unix seconds). */
  timestamp: number;
  /** Open price. */
  open: number;
  /** High price. */
  high: number;
  /** Low price. */
  low: number;
  /** Close price. */
  close: number;
  /** Volume in LORDS. */
  volume: bigint;
}

/** Aggregate pool statistics over a time window. */
export interface PoolStats {
  /** Token address. */
  tokenAddress: string;
  /** Total value locked in LORDS equivalent. */
  tvlLords: bigint;
  /** 24h volume in LORDS. */
  volume24h: bigint;
  /** 24h fee revenue in LORDS. */
  fees24h: bigint;
  /** Number of swaps in 24h. */
  swapCount24h: number;
  /** Current spot price (token per LORDS). */
  spotPrice: number;
}

/** A swap quote with computed details. */
export interface SwapQuote {
  /** Expected output amount. */
  amountOut: bigint;
  /** Price impact as a percentage (0-100). */
  priceImpact: number;
  /** Minimum received after slippage. */
  minimumReceived: bigint;
  /** Spot price before the swap. */
  spotPriceBefore: number;
  /** Spot price after the swap. */
  spotPriceAfter: number;
}

/** A user's position in a pool. */
export interface UserPosition {
  /** Token address (the pool). */
  tokenAddress: string;
  /** LP token balance. */
  lpBalance: bigint;
  /** Share of pool as a percentage (0-100). */
  poolShare: number;
  /** Estimated LORDS value of the position. */
  lordsValue: bigint;
  /** Estimated token value of the position. */
  tokenValue: bigint;
}

/** Pagination options for list queries. */
export interface PaginationOpts {
  /** Number of items per page. */
  limit?: number;
  /** Offset / cursor for pagination. */
  offset?: number;
}

/** Time range filter. */
export interface TimeRangeOpts {
  /** Start timestamp (unix seconds). */
  from?: number;
  /** End timestamp (unix seconds). */
  to?: number;
}

/** Candle interval for price history. */
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
