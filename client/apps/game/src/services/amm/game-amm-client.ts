import {
  AmmV2ApiClient,
  LiquidityTransactions as AmmV2LiquidityTransactions,
  SwapTransactions as AmmV2SwapTransactions,
  computeMinimumReceived,
  computePriceImpact,
  getAmountOut,
  type CandleInterval,
  type PaginatedResponse,
  type PaginationOpts,
  type PairStats,
  type PairSummary,
  type TimeRangeOpts,
} from "@bibliothecadao/ammv2-sdk";
import { computeMarketCapLords } from "./game-amm-market-cap";

const FEE_DENOMINATOR = 1000n;

export interface Pool {
  pairAddress: string;
  tokenAddress: string;
  lpTokenAddress: string;
  lordsReserve: bigint;
  tokenReserve: bigint;
  totalLpSupply: bigint;
  feeAmount: bigint;
  feeNum: bigint;
  feeDenom: bigint;
  feeTo: string;
}

export interface SwapEvent {
  txHash: string;
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  protocolFee: bigint;
  timestamp: number;
}

interface LiquidityEvent {
  txHash: string;
  provider: string;
  tokenAddress: string;
  lordsAmount: bigint;
  tokenAmount: bigint;
  lpAmount: bigint;
  type: "add" | "remove";
  timestamp: number;
}

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

interface PoolStats {
  tokenAddress: string;
  pairAddress: string;
  tvlLords: bigint;
  volume24h: bigint;
  fees24h: bigint;
  swapCount24h: number;
  spotPrice: number;
  feeTo: string;
  resourceSupply: bigint | null;
  marketCapLords: bigint | null;
  lpHolderCount: number;
}

interface UserPosition {
  tokenAddress: string;
  pairAddress: string;
  lpTokenAddress: string;
  lpBalance: bigint;
  poolShare: number;
  lordsValue: bigint;
  tokenValue: bigint;
}

interface SwapQuote {
  amountOut: bigint;
  priceImpact: number;
  minimumReceived: bigint;
  spotPriceBefore: number;
  spotPriceAfter: number;
}

interface GameAmmClientConfig {
  indexerUrl: string;
  lordsAddress: string;
  routerAddress: string;
}

interface LordsPairContext {
  lordsIsToken0: boolean;
  tokenAddress: string;
  lordsReserve: bigint;
  tokenReserve: bigint;
}

class GameAmmApiClient {
  constructor(
    private readonly apiClient: AmmV2ApiClient,
    private readonly lordsAddress: string,
  ) {}

  async getPools(): Promise<Pool[]> {
    const pairs = await this.apiClient.getPairs(this.lordsAddress);

    return pairs.map((pair) => mapPairToPool(pair, this.lordsAddress)).filter((pool): pool is Pool => pool !== null);
  }

  async getPoolStats(tokenAddress: string): Promise<PoolStats | null> {
    const pair = await this.loadLordsPair(tokenAddress);
    if (!pair) {
      return null;
    }

    const pairStats = await this.apiClient.getPairStats(pair.pairAddress);
    return mapPairStats(pair, pairStats, this.lordsAddress);
  }

  async getSwapHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<SwapEvent>> {
    const pair = await this.loadLordsPair(tokenAddress);
    if (!pair) {
      return emptyPaginatedResponse<SwapEvent>(opts);
    }

    const swaps = await this.apiClient.getSwapHistory(pair.pairAddress, opts);
    return {
      data: swaps.data.map((swap) => mapSwapEvent(pair, swap)),
      pagination: swaps.pagination,
    };
  }

  async getLiquidityHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<LiquidityEvent>> {
    const pair = await this.loadLordsPair(tokenAddress);
    if (!pair) {
      return emptyPaginatedResponse<LiquidityEvent>(opts);
    }

    const liquidityEvents = await this.apiClient.getLiquidityHistory(pair.pairAddress, opts);
    return {
      data: liquidityEvents.data.map((event) => mapLiquidityEvent(pair, event, this.lordsAddress)),
      pagination: liquidityEvents.pagination,
    };
  }

  async getPriceHistory(tokenAddress: string, interval: CandleInterval, opts?: TimeRangeOpts): Promise<PriceCandle[]> {
    const pair = await this.loadLordsPair(tokenAddress);
    if (!pair) {
      return [];
    }

    const candles = await this.apiClient.getPriceHistory(pair.pairAddress, interval, opts);
    return candles.map((candle) => mapPriceCandle(pair, candle, this.lordsAddress));
  }

  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    const positions = await this.apiClient.getUserPositions(userAddress);

    return positions
      .map((position) => mapUserPosition(position, this.lordsAddress))
      .filter((position): position is UserPosition => position !== null);
  }

  private async loadLordsPair(tokenAddress: string): Promise<PairSummary | null> {
    return this.apiClient.lookupPair(tokenAddress, this.lordsAddress);
  }
}

class GameAmmSwapTransactions {
  constructor(
    private readonly routerAddress: string,
    private readonly lordsAddress: string,
    private readonly transactions: AmmV2SwapTransactions,
  ) {}

  swapLordsForTokenWithApproval(props: {
    tokenAddress: string;
    lordsAmount: bigint;
    minTokenOut: bigint;
    recipientAddress: string;
    deadline?: number;
  }) {
    return this.transactions.swapExactTokensForTokensWithApproval({
      routerAddress: this.routerAddress,
      tokenInAddress: this.lordsAddress,
      amountIn: props.lordsAmount,
      minAmountOut: props.minTokenOut,
      path: [this.lordsAddress, props.tokenAddress],
      recipientAddress: props.recipientAddress,
      deadline: props.deadline,
    });
  }

  swapTokenForLordsWithApproval(props: {
    tokenAddress: string;
    tokenAmount: bigint;
    minLordsOut: bigint;
    recipientAddress: string;
    deadline?: number;
  }) {
    return this.transactions.swapExactTokensForTokensWithApproval({
      routerAddress: this.routerAddress,
      tokenInAddress: props.tokenAddress,
      amountIn: props.tokenAmount,
      minAmountOut: props.minLordsOut,
      path: [props.tokenAddress, this.lordsAddress],
      recipientAddress: props.recipientAddress,
      deadline: props.deadline,
    });
  }

  swapTokenForTokenWithApproval(props: {
    tokenInAddress: string;
    tokenOutAddress: string;
    amountIn: bigint;
    minAmountOut: bigint;
    recipientAddress: string;
    deadline?: number;
  }) {
    return this.transactions.swapExactTokensForTokensWithApproval({
      routerAddress: this.routerAddress,
      tokenInAddress: props.tokenInAddress,
      amountIn: props.amountIn,
      minAmountOut: props.minAmountOut,
      path: [props.tokenInAddress, this.lordsAddress, props.tokenOutAddress],
      recipientAddress: props.recipientAddress,
      deadline: props.deadline,
    });
  }
}

class GameAmmLiquidityTransactions {
  constructor(
    private readonly routerAddress: string,
    private readonly lordsAddress: string,
    private readonly transactions: AmmV2LiquidityTransactions,
  ) {}

  addLiquidityWithApproval(props: {
    tokenAddress: string;
    lordsAmount: bigint;
    tokenAmount: bigint;
    lordsMin: bigint;
    tokenMin: bigint;
    recipientAddress: string;
    deadline?: number;
  }) {
    return this.transactions.addLiquidityWithApproval({
      routerAddress: this.routerAddress,
      tokenAAddress: this.lordsAddress,
      tokenBAddress: props.tokenAddress,
      amountADesired: props.lordsAmount,
      amountBDesired: props.tokenAmount,
      amountAMin: props.lordsMin,
      amountBMin: props.tokenMin,
      recipientAddress: props.recipientAddress,
      deadline: props.deadline,
    });
  }

  removeLiquidity(props: {
    tokenAddress: string;
    lpTokenAddress: string;
    lpAmount: bigint;
    lordsMin: bigint;
    tokenMin: bigint;
    recipientAddress: string;
    deadline?: number;
  }) {
    return this.transactions.removeLiquidityWithApproval({
      routerAddress: this.routerAddress,
      tokenAAddress: this.lordsAddress,
      tokenBAddress: props.tokenAddress,
      lpTokenAddress: props.lpTokenAddress,
      liquidity: props.lpAmount,
      amountAMin: props.lordsMin,
      amountBMin: props.tokenMin,
      recipientAddress: props.recipientAddress,
      deadline: props.deadline,
    });
  }
}

export class GameAmmClient {
  readonly api: GameAmmApiClient;
  readonly swap: GameAmmSwapTransactions;
  readonly liquidity: GameAmmLiquidityTransactions;

  readonly ammAddress: string;
  readonly lordsAddress: string;
  readonly routerAddress: string;

  constructor(config: GameAmmClientConfig) {
    const apiClient = new AmmV2ApiClient(config.indexerUrl);
    const swapTransactions = new AmmV2SwapTransactions();
    const liquidityTransactions = new AmmV2LiquidityTransactions();

    this.api = new GameAmmApiClient(apiClient, config.lordsAddress);
    this.swap = new GameAmmSwapTransactions(config.routerAddress, config.lordsAddress, swapTransactions);
    this.liquidity = new GameAmmLiquidityTransactions(config.routerAddress, config.lordsAddress, liquidityTransactions);
    this.ammAddress = config.routerAddress;
    this.routerAddress = config.routerAddress;
    this.lordsAddress = config.lordsAddress;
  }

  quoteSwap(pool: Pool, amountIn: bigint, isLordsInput: boolean, slippageBps: bigint): SwapQuote {
    const [inputReserve, outputReserve] = isLordsInput
      ? [pool.lordsReserve, pool.tokenReserve]
      : [pool.tokenReserve, pool.lordsReserve];
    const amountOut = getAmountOut(amountIn, inputReserve, outputReserve, pool.feeAmount);
    const newInputReserve = inputReserve + amountIn;
    const newOutputReserve = outputReserve - amountOut;

    return {
      amountOut,
      priceImpact: computePriceImpact(amountIn, inputReserve, outputReserve, pool.feeAmount),
      minimumReceived: computeMinimumReceived(amountOut, slippageBps),
      spotPriceBefore: isLordsInput
        ? computeQuoteRatio(pool.lordsReserve, pool.tokenReserve)
        : computeQuoteRatio(pool.tokenReserve, pool.lordsReserve),
      spotPriceAfter: isLordsInput
        ? computeQuoteRatio(newInputReserve, newOutputReserve)
        : computeQuoteRatio(newOutputReserve, newInputReserve),
    };
  }
}

function emptyPaginatedResponse<T>(opts?: PaginationOpts): PaginatedResponse<T> {
  return {
    data: [],
    pagination: {
      total: 0,
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
    },
  };
}

function mapPairToPool(pair: PairSummary, lordsAddress: string): Pool | null {
  const pairContext = resolveLordsPairContext(pair, lordsAddress);
  if (!pairContext) {
    return null;
  }

  return {
    pairAddress: pair.pairAddress,
    tokenAddress: pairContext.tokenAddress,
    lpTokenAddress: pair.lpTokenAddress,
    lordsReserve: pairContext.lordsReserve,
    tokenReserve: pairContext.tokenReserve,
    totalLpSupply: pair.totalLpSupply,
    feeAmount: pair.feeAmount,
    feeNum: FEE_DENOMINATOR - pair.feeAmount,
    feeDenom: FEE_DENOMINATOR,
    feeTo: pair.feeTo,
  };
}

function mapPairStats(pair: PairSummary, pairStats: PairStats, lordsAddress: string): PoolStats | null {
  const pairContext = resolveLordsPairContext(pair, lordsAddress);
  if (!pairContext) {
    return null;
  }

  const spotPrice = pairContext.lordsIsToken0 ? pairStats.spotPriceToken0PerToken1 : pairStats.spotPriceToken1PerToken0;

  return {
    tokenAddress: pairContext.tokenAddress,
    pairAddress: pair.pairAddress,
    tvlLords: pairContext.lordsReserve * 2n,
    volume24h: pairContext.lordsIsToken0 ? pairStats.volume0_24h : pairStats.volume1_24h,
    fees24h: pairContext.lordsIsToken0 ? pairStats.lpFees0_24h : pairStats.lpFees1_24h,
    swapCount24h: pairStats.swapCount24h,
    spotPrice,
    feeTo: pairStats.feeTo,
    resourceSupply: pairStats.resourceTokenSupply,
    marketCapLords: computeMarketCapLords(pairStats.resourceTokenSupply, spotPrice),
    lpHolderCount: pairStats.lpHolderCount,
  };
}

function mapSwapEvent(
  pair: PairSummary,
  swap: {
    txHash: string;
    initiatorAddress: string;
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
    timestamp: number;
  },
): SwapEvent {
  const tokenIn = swap.amount0In > 0n ? pair.token0Address : pair.token1Address;
  const tokenOut = swap.amount0Out > 0n ? pair.token0Address : pair.token1Address;
  const amountIn = swap.amount0In > 0n ? swap.amount0In : swap.amount1In;
  const amountOut = swap.amount0Out > 0n ? swap.amount0Out : swap.amount1Out;

  return {
    txHash: swap.txHash,
    user: swap.initiatorAddress,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    protocolFee: 0n,
    timestamp: swap.timestamp,
  };
}

function mapLiquidityEvent(
  pair: PairSummary,
  event: {
    txHash: string;
    providerAddress: string;
    eventType: "add" | "remove";
    amount0: bigint;
    amount1: bigint;
    lpAmount: bigint;
    timestamp: number;
  },
  lordsAddress: string,
): LiquidityEvent {
  const pairContext = resolveLordsPairContext(pair, lordsAddress);
  if (!pairContext) {
    throw new Error(`Pair ${pair.pairAddress} does not include LORDS`);
  }

  return {
    txHash: event.txHash,
    provider: event.providerAddress,
    tokenAddress: pairContext.tokenAddress,
    lordsAmount: pairContext.lordsIsToken0 ? event.amount0 : event.amount1,
    tokenAmount: pairContext.lordsIsToken0 ? event.amount1 : event.amount0,
    lpAmount: event.lpAmount,
    type: event.eventType,
    timestamp: event.timestamp,
  };
}

function mapPriceCandle(
  pair: PairSummary,
  candle: {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume0: bigint;
    volume1: bigint;
  },
  lordsAddress: string,
): PriceCandle {
  const pairContext = resolveLordsPairContext(pair, lordsAddress);
  if (!pairContext) {
    throw new Error(`Pair ${pair.pairAddress} does not include LORDS`);
  }

  if (!pairContext.lordsIsToken0) {
    return {
      timestamp: candle.openTime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume1,
    };
  }

  return {
    timestamp: candle.openTime,
    open: invertPrice(candle.open),
    high: invertPrice(candle.low),
    low: invertPrice(candle.high),
    close: invertPrice(candle.close),
    volume: candle.volume0,
  };
}

function mapUserPosition(
  position: {
    amount0: bigint;
    amount1: bigint;
    lpBalance: bigint;
    lpTokenAddress: string;
    pairAddress: string;
    poolShare: number;
    token0Address: string;
    token1Address: string;
  },
  lordsAddress: string,
): UserPosition | null {
  const pairContext = resolveLordsPositionContext(position, lordsAddress);
  if (!pairContext) {
    return null;
  }

  return {
    tokenAddress: pairContext.tokenAddress,
    pairAddress: position.pairAddress,
    lpTokenAddress: position.lpTokenAddress,
    lpBalance: position.lpBalance,
    poolShare: position.poolShare,
    lordsValue: pairContext.lordsIsToken0 ? position.amount0 : position.amount1,
    tokenValue: pairContext.lordsIsToken0 ? position.amount1 : position.amount0,
  };
}

function resolveLordsPositionContext(
  position: {
    amount0: bigint;
    amount1: bigint;
    token0Address: string;
    token1Address: string;
  },
  lordsAddress: string,
): LordsPairContext | null {
  const normalizedLordsAddress = normalizeAddress(lordsAddress);
  const token0Address = normalizeAddress(position.token0Address);
  const token1Address = normalizeAddress(position.token1Address);

  if (token0Address === normalizedLordsAddress) {
    return {
      lordsIsToken0: true,
      tokenAddress: position.token1Address,
      lordsReserve: position.amount0,
      tokenReserve: position.amount1,
    };
  }

  if (token1Address === normalizedLordsAddress) {
    return {
      lordsIsToken0: false,
      tokenAddress: position.token0Address,
      lordsReserve: position.amount1,
      tokenReserve: position.amount0,
    };
  }

  return null;
}

function resolveLordsPairContext(pair: PairSummary, lordsAddress: string): LordsPairContext | null {
  const normalizedLordsAddress = normalizeAddress(lordsAddress);
  const token0Address = normalizeAddress(pair.token0Address);
  const token1Address = normalizeAddress(pair.token1Address);

  if (token0Address === normalizedLordsAddress) {
    return {
      lordsIsToken0: true,
      tokenAddress: pair.token1Address,
      lordsReserve: pair.reserve0,
      tokenReserve: pair.reserve1,
    };
  }

  if (token1Address === normalizedLordsAddress) {
    return {
      lordsIsToken0: false,
      tokenAddress: pair.token0Address,
      lordsReserve: pair.reserve1,
      tokenReserve: pair.reserve0,
    };
  }

  return null;
}

function computeQuoteRatio(baseReserve: bigint, quoteReserve: bigint): number {
  if (baseReserve <= 0n || quoteReserve <= 0n) {
    return 0;
  }

  return Number(baseReserve) / Number(quoteReserve);
}

function invertPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return 1 / value;
}

function normalizeAddress(value: string): string {
  if (!value.startsWith("0x")) {
    return value.trim().toLowerCase();
  }

  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}
