import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CairoCustomEnum } from "starknet";
import { useMemo } from "react";

import type { RegisteredToken } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { MarketStatusFilter, MarketTypeFilter, getPmSqlApiForUrl, type MarketWithDetailsRow } from "@/pm/hooks/queries";
import { useConfig } from "@/pm/providers";
import { formatUnits, replaceAndFormat } from "@/pm/utils";
import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";

type MarketDataChain = "slot" | "mainnet";
export type MarketChainFilter = "all" | MarketDataChain;
export type MarketStatusKey = "all" | "live" | "awaiting" | "resolved";

type SourceStatus = {
  ok: boolean;
  error?: string;
};

export type EnrichedMarket = {
  key: string;
  chain: MarketDataChain;
  market: MarketClass;
  volumeRaw: bigint;
  volumeDisplay: string;
};

const STATUS_TO_FILTER: Record<MarketStatusKey, MarketStatusFilter> = {
  all: MarketStatusFilter.All,
  live: MarketStatusFilter.Open,
  awaiting: MarketStatusFilter.Resolvable,
  resolved: MarketStatusFilter.Resolved,
};

const CHAIN_ORDER: MarketDataChain[] = ["slot", "mainnet"];

const CHAIN_LABELS: Record<MarketDataChain, string> = {
  slot: "Slot",
  mainnet: "Mainnet",
};

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unknown data source error";
};

const getSelectedChains = (chainFilter: MarketChainFilter): MarketDataChain[] =>
  chainFilter === "all" ? CHAIN_ORDER : [chainFilter];

const buildMarketTypeEnum = (row: MarketWithDetailsRow): CairoCustomEnum => {
  if (row["typ.Binary"] !== null && row["typ.Binary"] !== undefined) {
    return new CairoCustomEnum({ Binary: {} });
  }

  if (row["typ.Categorical.ValueEq"]) {
    const rawValueEq = JSON.parse(row["typ.Categorical.ValueEq"]);
    const valueEq = rawValueEq.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ ValueEq: valueEq }),
    });
  }

  if (row["typ.Categorical.Ranges"]) {
    const rawRanges = JSON.parse(row["typ.Categorical.Ranges"]);
    const ranges = rawRanges.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ Ranges: ranges }),
    });
  }

  return new CairoCustomEnum({
    Categorical: new CairoCustomEnum({ ValueEq: [] }),
  });
};

const transformToMarketClass = (
  row: MarketWithDetailsRow,
  numeratorsByMarketId: Map<string, Array<{ index: number; value: string }>>,
  getRegisteredToken: (address: string | undefined) => RegisteredToken,
): MarketClass | null => {
  if (!row.title) return null;

  const collateralToken = getRegisteredToken(row.collateral_token);
  const numerators = numeratorsByMarketId.get(row.market_id) ?? [];
  const oracleParams = row.oracle_params ? JSON.parse(row.oracle_params) : [];

  const rowAny = row as unknown as Record<string, string | undefined>;
  const getRowValue = (key: string): string | undefined => rowAny[key];

  const feeCurveStart =
    getRowValue("model.Vault.fee_curve.Range.start") ?? getRowValue("model.Vault.fee_curve.Linear.start");
  const feeCurveEnd = getRowValue("model.Vault.fee_curve.Range.end") ?? getRowValue("model.Vault.fee_curve.Linear.end");
  const feeShareCurveStart =
    getRowValue("model.Vault.fee_share_curve.Range.start") ?? getRowValue("model.Vault.fee_share_curve.Linear.start");
  const feeShareCurveEnd =
    getRowValue("model.Vault.fee_share_curve.Range.end") ?? getRowValue("model.Vault.fee_share_curve.Linear.end");

  const vaultModel = {
    initial_repartition: getRowValue("model.Vault.initial_repartition")
      ? JSON.parse(getRowValue("model.Vault.initial_repartition")!)
      : [],
    funding_amount: BigInt(getRowValue("model.Vault.funding_amount") ?? 0),
    fee_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(feeCurveStart ?? 0),
        end: BigInt(feeCurveEnd ?? 0),
      },
    }),
    fee_share_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(feeShareCurveStart ?? 0),
        end: BigInt(feeShareCurveEnd ?? 0),
      },
    }),
  };

  const market = {
    market_id: BigInt(row.market_id),
    creator: row.creator,
    created_at: BigInt(row.created_at),
    question_id: BigInt(row.question_id),
    condition_id: BigInt(row.condition_id),
    oracle: row.oracle,
    outcome_slot_count: row.outcome_slot_count,
    collateral_token: row.collateral_token,
    model: new CairoCustomEnum({ Vault: vaultModel }),
    typ: buildMarketTypeEnum(row),
    oracle_params: oracleParams,
    oracle_extra_params: [],
    oracle_value_type: row.oracle_value_type,
    start_at: BigInt(row.start_at),
    end_at: BigInt(row.end_at),
    resolve_at: BigInt(row.resolve_at),
    resolved_at: BigInt(row.resolved_at),
    oracle_fee: row.oracle_fee,
    creator_fee: row.creator_fee,
  };

  const marketCreated = {
    market_id: BigInt(row.market_id),
    title: replaceAndFormat(row.title),
    terms: replaceAndFormat(row.terms ?? ""),
    position_ids: row.position_ids ? JSON.parse(row.position_ids) : [],
  };

  const vaultDenominator = row.denominator
    ? { market_id: BigInt(row.market_id), value: BigInt(row.denominator) }
    : undefined;

  const vaultNumerators = numerators.map((entry) => ({
    market_id: BigInt(row.market_id),
    index: entry.index,
    value: BigInt(entry.value),
  }));

  return new MarketClass({
    market: market as never,
    marketCreated: marketCreated as never,
    collateralToken,
    vaultDenominator: vaultDenominator as never,
    vaultNumerators: vaultNumerators as never[],
  });
};

const formatVolumeDisplay = (amountRaw: bigint, decimals: number) => {
  const normalized = formatUnits(amountRaw, decimals, 6).replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return "0";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
};

const fetchChainMarkets = async ({
  chain,
  status,
  now,
  getRegisteredToken,
}: {
  chain: MarketDataChain;
  status: MarketStatusFilter;
  now: number;
  getRegisteredToken: (address: string | undefined) => RegisteredToken;
}): Promise<EnrichedMarket[]> => {
  const toriiUrl = GLOBAL_TORII_BY_CHAIN[chain];
  const api = getPmSqlApiForUrl(toriiUrl);

  const filters = {
    status,
    type: MarketTypeFilter.All,
    oracle: "All",
  };

  const totalCount = await api.fetchMarketsCount(filters, now);
  if (totalCount <= 0) return [];

  const rows = await api.fetchMarketsWithDetails(filters, now, totalCount, 0);
  if (rows.length === 0) return [];

  const marketIds = rows.map((row) => row.market_id);
  const [numerators, buyRows] = await Promise.all([
    api.fetchVaultNumeratorsByMarkets(marketIds),
    api.fetchMarketBuyAmountsByMarkets(marketIds),
  ]);

  const numeratorsByMarketId = new Map<string, Array<{ index: number; value: string }>>();
  numerators.forEach((entry) => {
    const previous = numeratorsByMarketId.get(entry.market_id) ?? [];
    previous.push({ index: entry.index, value: entry.value });
    numeratorsByMarketId.set(entry.market_id, previous);
  });
  numeratorsByMarketId.forEach((entries, marketId) => {
    numeratorsByMarketId.set(
      marketId,
      entries.toSorted((a, b) => a.index - b.index),
    );
  });

  const volumeByMarketId = new Map<string, bigint>();
  buyRows.forEach((entry) => {
    const current = volumeByMarketId.get(entry.market_id) ?? 0n;
    volumeByMarketId.set(entry.market_id, current + toBigInt(entry.amount_in));
  });

  return rows
    .map((row) => {
      const market = transformToMarketClass(row, numeratorsByMarketId, getRegisteredToken);
      if (!market) return null;

      const volumeRaw = volumeByMarketId.get(row.market_id) ?? 0n;
      const decimals = Number(market.collateralToken?.decimals ?? 18);

      return {
        key: `${chain}:${row.market_id}`,
        chain,
        market,
        volumeRaw,
        volumeDisplay: formatVolumeDisplay(volumeRaw, decimals),
      } satisfies EnrichedMarket;
    })
    .filter((item): item is EnrichedMarket => Boolean(item));
};

const mergeAndSortByVolume = (markets: EnrichedMarket[]) =>
  markets.toSorted((a, b) => {
    if (a.volumeRaw !== b.volumeRaw) return a.volumeRaw > b.volumeRaw ? -1 : 1;
    return Number(b.market.created_at ?? 0) - Number(a.market.created_at ?? 0);
  });

const createEmptySourceStatus = (chains: MarketDataChain[]): Record<MarketDataChain, SourceStatus> => {
  const status: Record<MarketDataChain, SourceStatus> = {
    slot: { ok: true },
    mainnet: { ok: true },
  };
  CHAIN_ORDER.forEach((chain) => {
    if (!chains.includes(chain)) {
      status[chain] = { ok: true };
    }
  });
  return status;
};

export function useMultiChainMarketCounts(chainFilter: MarketChainFilter) {
  const selectedChains = useMemo(() => getSelectedChains(chainFilter), [chainFilter]);

  const query = useQuery({
    queryKey: ["pm", "multi-chain", "counts", chainFilter],
    queryFn: async () => {
      const now = Math.ceil(Date.now() / 1000);

      const counts = {
        all: 0,
        live: 0,
        awaiting: 0,
        resolved: 0,
      } as Record<MarketStatusKey, number>;

      const sourceStatus = createEmptySourceStatus(selectedChains);

      await Promise.all(
        selectedChains.map(async (chain) => {
          const toriiUrl = GLOBAL_TORII_BY_CHAIN[chain];
          const api = getPmSqlApiForUrl(toriiUrl);

          try {
            const [all, live, awaiting, resolved] = await Promise.all([
              api.fetchMarketsCount({ status: MarketStatusFilter.All, type: MarketTypeFilter.All, oracle: "All" }, now),
              api.fetchMarketsCount(
                { status: MarketStatusFilter.Open, type: MarketTypeFilter.All, oracle: "All" },
                now,
              ),
              api.fetchMarketsCount(
                { status: MarketStatusFilter.Resolvable, type: MarketTypeFilter.All, oracle: "All" },
                now,
              ),
              api.fetchMarketsCount(
                { status: MarketStatusFilter.Resolved, type: MarketTypeFilter.All, oracle: "All" },
                now,
              ),
            ]);

            counts.all += all;
            counts.live += live;
            counts.awaiting += awaiting;
            counts.resolved += resolved;
            sourceStatus[chain] = { ok: true };
          } catch (error) {
            sourceStatus[chain] = { ok: false, error: toErrorMessage(error) };
          }
        }),
      );

      return { counts, sourceStatus };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return {
    counts: query.data?.counts ?? { all: 0, live: 0, awaiting: 0, resolved: 0 },
    sourceStatus: query.data?.sourceStatus ?? createEmptySourceStatus(selectedChains),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

export function useMultiChainMarkets({
  status,
  chainFilter,
  limit,
  offset,
}: {
  status: MarketStatusKey;
  chainFilter: MarketChainFilter;
  limit: number;
  offset: number;
}) {
  const { getRegisteredToken } = useConfig();
  const queryClient = useQueryClient();
  const selectedChains = useMemo(() => getSelectedChains(chainFilter), [chainFilter]);

  const query = useQuery({
    queryKey: ["pm", "multi-chain", "markets", status, chainFilter],
    queryFn: async () => {
      const now = Math.ceil(Date.now() / 1000);
      const sourceStatus = createEmptySourceStatus(selectedChains);
      const statusFilter = STATUS_TO_FILTER[status];

      const results = await Promise.allSettled(
        selectedChains.map((chain) =>
          fetchChainMarkets({
            chain,
            status: statusFilter,
            now,
            getRegisteredToken,
          }),
        ),
      );

      const merged: EnrichedMarket[] = [];
      results.forEach((result, index) => {
        const chain = selectedChains[index];
        if (result.status === "fulfilled") {
          merged.push(...result.value);
          sourceStatus[chain] = { ok: true };
          return;
        }

        sourceStatus[chain] = { ok: false, error: toErrorMessage(result.reason) };
      });

      return {
        markets: mergeAndSortByVolume(merged),
        sourceStatus,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const pagedMarkets = useMemo(() => {
    const rows = query.data?.markets ?? [];
    if (rows.length === 0) return [];
    return rows.slice(offset, offset + limit);
  }, [limit, offset, query.data?.markets]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pm", "multi-chain", "markets"] });
    queryClient.invalidateQueries({ queryKey: ["pm", "multi-chain", "counts"] });
  };

  return {
    markets: pagedMarkets,
    totalCount: query.data?.markets.length ?? 0,
    sourceStatus: query.data?.sourceStatus ?? createEmptySourceStatus(selectedChains),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refresh,
  };
}

export const marketChainLabels = CHAIN_LABELS;
