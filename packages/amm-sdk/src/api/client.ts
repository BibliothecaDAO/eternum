import type {
  CandleInterval,
  LiquidityEvent,
  PaginationOpts,
  Pool,
  PoolStats,
  PriceCandle,
  SwapEvent,
  TimeRangeOpts,
  UserPosition,
} from "../types";

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * REST API client for the AMM indexer.
 * All methods are async and return typed responses.
 */
export class AmmApiClient {
  private baseUrl: string;

  constructor(indexerUrl: string) {
    // Strip trailing slash
    this.baseUrl = indexerUrl.replace(/\/+$/, "");
  }

  private async fetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await globalThis.fetch(url.toString());
    if (!response.ok) {
      throw new Error(`AMM API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  /** Get all pools. */
  async getPools(): Promise<Pool[]> {
    return this.fetch<Pool[]>("/pools");
  }

  /** Get a specific pool by token address. */
  async getPool(tokenAddress: string): Promise<Pool | null> {
    try {
      return await this.fetch<Pool>(`/pools/${tokenAddress}`);
    } catch {
      return null;
    }
  }

  /** Get swap history for a pool. */
  async getSwapHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<SwapEvent>> {
    return this.fetch<PaginatedResponse<SwapEvent>>(`/pools/${tokenAddress}/swaps`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });
  }

  /** Get liquidity event history for a pool. */
  async getLiquidityHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<LiquidityEvent>> {
    return this.fetch<PaginatedResponse<LiquidityEvent>>(`/pools/${tokenAddress}/liquidity`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });
  }

  /** Get price candle history for a pool. */
  async getPriceHistory(
    tokenAddress: string,
    interval: CandleInterval,
    opts?: TimeRangeOpts,
  ): Promise<PriceCandle[]> {
    return this.fetch<PriceCandle[]>(`/pools/${tokenAddress}/candles`, {
      interval,
      from: opts?.from,
      to: opts?.to,
    });
  }

  /** Get aggregate stats for a pool. */
  async getPoolStats(tokenAddress: string): Promise<PoolStats> {
    return this.fetch<PoolStats>(`/pools/${tokenAddress}/stats`);
  }

  /** Get a user's LP positions across all pools. */
  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    return this.fetch<UserPosition[]>(`/users/${userAddress}/positions`);
  }
}
