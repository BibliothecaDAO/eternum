import type {
  CandleInterval,
  PaginationOpts,
  PairLiquidityEvent,
  PairStats,
  PairSummary,
  PairSwapEvent,
  PriceCandle,
  TimeRangeOpts,
  UserPairPosition,
} from "../types";
import {
  decodePairLiquidityEvent,
  decodePairStats,
  decodePairSummary,
  decodePairSwapEvent,
  decodePriceCandle,
  decodeUserPairPosition,
  type RawPairLiquidityEvent,
  type RawPairStats,
  type RawPairSummary,
  type RawPairSwapEvent,
  type RawPriceCandle,
  type RawUserPairPosition,
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

export class AmmV2ApiClient {
  private baseUrl: string;

  constructor(indexerUrl: string) {
    this.baseUrl = normalizeApiBaseUrl(indexerUrl);
  }

  async getPairs(token?: string): Promise<PairSummary[]> {
    const response = await this.fetch<RawPairSummary[] | { data: RawPairSummary[] }>("/pairs", {
      token,
    });
    return unwrapApiData(response).map((pair) => decodePairSummary(pair));
  }

  async getPair(pairAddress: string): Promise<PairSummary | null> {
    try {
      const response = await this.fetch<RawPairSummary | { data: RawPairSummary }>(`/pairs/${pairAddress}`);
      return decodePairSummary(unwrapApiData(response));
    } catch {
      return null;
    }
  }

  async lookupPair(tokenA: string, tokenB: string): Promise<PairSummary | null> {
    try {
      const response = await this.fetch<RawPairSummary | { data: RawPairSummary }>("/pairs/lookup", {
        tokenA,
        tokenB,
      });
      return decodePairSummary(unwrapApiData(response));
    } catch {
      return null;
    }
  }

  async getSwapHistory(
    pairAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<PairSwapEvent>> {
    const response = await this.fetch<PaginatedResponse<RawPairSwapEvent>>(`/pairs/${pairAddress}/swaps`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });

    return {
      data: response.data.map((swap) => decodePairSwapEvent(swap)),
      pagination: {
        total: response.pagination.total,
        limit: response.pagination.limit,
        offset: response.pagination.offset,
      },
    };
  }

  async getLiquidityHistory(
    pairAddress: string,
    opts?: PaginationOpts & TimeRangeOpts,
  ): Promise<PaginatedResponse<PairLiquidityEvent>> {
    const response = await this.fetch<PaginatedResponse<RawPairLiquidityEvent>>(`/pairs/${pairAddress}/liquidity`, {
      limit: opts?.limit,
      offset: opts?.offset,
      from: opts?.from,
      to: opts?.to,
    });

    return {
      data: response.data.map((event) => decodePairLiquidityEvent(event)),
      pagination: {
        total: response.pagination.total,
        limit: response.pagination.limit,
        offset: response.pagination.offset,
      },
    };
  }

  async getPriceHistory(pairAddress: string, interval: CandleInterval, opts?: TimeRangeOpts): Promise<PriceCandle[]> {
    const response = await this.fetch<RawPriceCandle[] | { data: RawPriceCandle[] }>(`/pairs/${pairAddress}/candles`, {
      interval,
      from: opts?.from,
      to: opts?.to,
    });
    return unwrapApiData(response).map((candle) => decodePriceCandle(candle));
  }

  async getPairStats(pairAddress: string): Promise<PairStats> {
    const response = await this.fetch<RawPairStats | { data: RawPairStats }>(`/pairs/${pairAddress}/stats`);
    return decodePairStats(unwrapApiData(response));
  }

  async getUserPositions(userAddress: string): Promise<UserPairPosition[]> {
    const response = await this.fetch<RawUserPairPosition[] | { data: RawUserPairPosition[] }>(
      `/users/${userAddress}/positions`,
    );
    return unwrapApiData(response).map((position) => decodeUserPairPosition(position));
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
      throw new Error(`AMMv2 API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}
