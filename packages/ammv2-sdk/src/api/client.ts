import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
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

export class PairNotFound extends Data.TaggedError("PairNotFound")<{ path: string }> {}

export class AmmApiFailure extends Data.TaggedError("AmmApiFailure")<{
  kind: "transport" | "http" | "decode";
  status?: number;
  cause?: unknown;
}> {
  get message() {
    return `AMMv2 ${this.kind} failure${this.status === undefined ? "" : ` (HTTP ${this.status})`}`;
  }
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

  getPair(pairAddress: string) {
    return this.readPair(`/pairs/${pairAddress}`);
  }

  lookupPair(tokenA: string, tokenB: string) {
    return this.readPair("/pairs/lookup", { tokenA, tokenB });
  }

  private readPair(path: string, params?: Record<string, string>) {
    return Effect.tryPromise({
      try: () => this.fetch<unknown>(path, params),
      catch: (cause) => (cause instanceof AmmApiFailure ? cause : new AmmApiFailure({ kind: "transport", cause })),
    }).pipe(
      Effect.catchIf(
        (failure) => failure.status === 404,
        () => Effect.fail(new PairNotFound({ path })),
      ),
      Effect.flatMap((response) =>
        Effect.try({
          try: () => decodePairSummary(unwrapApiData(response)),
          catch: (cause) => new AmmApiFailure({ kind: "decode", cause }),
        }),
      ),
    );
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
      throw new AmmApiFailure({ kind: "http", status: response.status });
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new AmmApiFailure({ kind: "decode", cause });
    }
  }
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}
