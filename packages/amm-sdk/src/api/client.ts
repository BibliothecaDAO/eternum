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
import {
  decodeLiquidityEvent,
  decodePool,
  decodePoolStats,
  decodePriceCandle,
  decodeSwapEvent,
  decodeUserPosition,
  type RawLiquidityEvent,
  type RawPool,
  type RawPoolStats,
  type RawPriceCandle,
  type RawSwapEvent,
  type RawUserPosition,
  unwrapApiData,
} from "./codec";

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
    this.baseUrl = normalizeApiBaseUrl(indexerUrl);
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
    const response = await this.fetch<RawPool[] | { data: RawPool[] }>("/pools");
    return unwrapApiData(response).map((pool) => decodePool(pool));
  }

  /** Get a specific pool by token address. */
  async getPool(tokenAddress: string): Promise<Pool | null> {
    try {
      const response = await this.fetch<RawPool | { data: RawPool }>(`/pools/${tokenAddress}`);
      return decodePool(unwrapApiData(response));
    } catch {
      return null;
    }
  }

  /** Get swap history for a pool. */
  async getSwapHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<SwapEvent>> {
    const response = await this.fetch<PaginatedResponse<RawSwapEvent>>(`/pools/${tokenAddress}/swaps`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });
    return {
      data: response.data.map((swap) => decodeSwapEvent(swap)),
      pagination: {
        total: response.pagination.total,
        limit: response.pagination.limit,
        offset: response.pagination.offset,
      },
    };
  }

  /** Get liquidity event history for a pool. */
  async getLiquidityHistory(
    tokenAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<LiquidityEvent>> {
    const response = await this.fetch<PaginatedResponse<RawLiquidityEvent>>(`/pools/${tokenAddress}/liquidity`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });
    return {
      data: response.data.map((event) => decodeLiquidityEvent(event)),
      pagination: {
        total: response.pagination.total,
        limit: response.pagination.limit,
        offset: response.pagination.offset,
      },
    };
  }

  /** Get price candle history for a pool. */
  async getPriceHistory(tokenAddress: string, interval: CandleInterval, opts?: TimeRangeOpts): Promise<PriceCandle[]> {
    const response = await this.fetch<RawPriceCandle[] | { data: RawPriceCandle[] }>(`/pools/${tokenAddress}/candles`, {
      interval,
      from: opts?.from,
      to: opts?.to,
    });
    return unwrapApiData(response).map((candle) => decodePriceCandle(candle));
  }

  /** Get aggregate stats for a pool. */
  async getPoolStats(tokenAddress: string): Promise<PoolStats> {
    const response = await this.fetch<RawPoolStats | { data: RawPoolStats }>(`/pools/${tokenAddress}/stats`);
    return decodePoolStats(unwrapApiData(response));
  }

  /** Get a user's LP positions across all pools. */
  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    const response = await this.fetch<RawUserPosition[] | { data: RawUserPosition[] }>(`/users/${userAddress}/positions`);
    return unwrapApiData(response).map((position) => decodeUserPosition(position));
  }
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}
