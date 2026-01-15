import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CairoCustomEnum } from "starknet";

import type { RegisteredToken } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useConfig } from "@/pm/providers";
import { replaceAndFormat } from "@/pm/utils";
import { getPmSqlApi, pmQueryKeys, type MarketWithDetailsRow, type VaultNumeratorRow } from "@/pm/hooks/queries";
import { dojoConfig } from "../../../../../dojo-config";

const normalizeHex = (value: unknown): string | null => {
  if (value == null) return null;
  try {
    const bigVal = typeof value === "string" ? BigInt(value) : BigInt(value as number);
    // Pad to 64 characters (standard Starknet address length) to preserve leading zeros
    return `0x${bigVal.toString(16).toLowerCase().padStart(64, "0")}`;
  } catch {
    return null;
  }
};

/**
 * Build proper CairoCustomEnum for the market type field
 */
function buildMarketTypeEnum(row: MarketWithDetailsRow): CairoCustomEnum {
  const rowAny = row as unknown as Record<string, string | undefined>;

  if (rowAny["typ.Binary"] !== null && rowAny["typ.Binary"] !== undefined) {
    return new CairoCustomEnum({ Binary: {} });
  }

  if (rowAny["typ.Categorical.ValueEq"]) {
    const rawValueEq = JSON.parse(rowAny["typ.Categorical.ValueEq"]);
    const valueEq = rawValueEq.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ ValueEq: valueEq }),
    });
  }

  if (rowAny["typ.Categorical.Ranges"]) {
    const rawRanges = JSON.parse(rowAny["typ.Categorical.Ranges"]);
    const ranges = rawRanges.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ Ranges: ranges }),
    });
  }

  return new CairoCustomEnum({
    Categorical: new CairoCustomEnum({ ValueEq: [] }),
  });
}

/**
 * Transform SQL row to MarketClass
 */
function transformRowToMarketClass(
  row: MarketWithDetailsRow,
  numerators: VaultNumeratorRow[],
  getRegisteredToken: (address: string | undefined) => RegisteredToken,
): MarketClass | null {
  if (!row.title) return null;

  const collateralToken = getRegisteredToken(row.collateral_token);
  const rowAny = row as unknown as Record<string, string | undefined>;
  const getRowValue = (key: string): string | undefined => rowAny[key];

  // Parse oracle_params
  const oracleParams = row.oracle_params ? JSON.parse(row.oracle_params) : [];

  // Build vault model
  const vaultModel = {
    initial_repartition: getRowValue("model.Vault.initial_repartition")
      ? JSON.parse(getRowValue("model.Vault.initial_repartition")!)
      : [],
    funding_amount: BigInt(getRowValue("model.Vault.funding_amount") ?? 0),
    fee_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue("model.Vault.fee_curve.Range.start") ?? 0),
        end: BigInt(getRowValue("model.Vault.fee_curve.Range.end") ?? 0),
      },
    }),
    fee_share_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue("model.Vault.fee_share_curve.Range.start") ?? 0),
        end: BigInt(getRowValue("model.Vault.fee_share_curve.Range.end") ?? 0),
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

  const vaultNumerators = numerators.map((n) => ({
    market_id: BigInt(n.market_id),
    index: n.index,
    value: BigInt(n.value),
  }));

  return new MarketClass({
    market: market as never,
    marketCreated: marketCreated as never,
    collateralToken,
    vaultDenominator: vaultDenominator as never,
    vaultNumerators: vaultNumerators as never[],
  });
}

/**
 * Hook that finds the prediction market associated with the current game.
 * Optimized to query directly by prize address instead of fetching all markets.
 */
export const useCurrentGameMarket = () => {
  const { manifest } = dojoConfig;
  const { registeredTokens, getRegisteredToken } = useConfig();
  const queryClient = useQueryClient();

  // Get current game's prize distribution contract address from manifest
  const currentPrizeAddress = useMemo(() => {
    const contracts = manifest?.contracts;
    if (!Array.isArray(contracts)) return null;

    const prizeContract = contracts.find((c: { tag?: string }) => c.tag === "s1_eternum-prize_distribution_systems");
    return prizeContract?.address ? normalizeHex(prizeContract.address) : null;
  }, [manifest]);

  // Fetch market directly by prize address (optimized - single market query)
  const marketQuery = useQuery({
    queryKey: pmQueryKeys.marketByPrizeAddress(currentPrizeAddress ?? ""),
    queryFn: async () => {
      if (!currentPrizeAddress) return null;
      const api = getPmSqlApi();
      const result = await api.fetchMarketByPrizeAddress(currentPrizeAddress);
      if (!result) {
        console.debug("[useCurrentGameMarket] No market found for prize address:", currentPrizeAddress);
      }
      return result;
    },
    enabled: !!currentPrizeAddress && registeredTokens.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch numerators for the market if found
  const numeratorsQuery = useQuery({
    queryKey: pmQueryKeys.marketNumerators(marketQuery.data ? [marketQuery.data.market_id] : []),
    queryFn: async () => {
      if (!marketQuery.data) return [];
      const api = getPmSqlApi();
      return api.fetchVaultNumeratorsByMarkets([marketQuery.data.market_id]);
    },
    enabled: !!marketQuery.data,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Transform to MarketClass
  const gameMarket = useMemo(() => {
    if (!marketQuery.data || !registeredTokens.length) return null;
    const numerators = numeratorsQuery.data ?? [];
    return transformRowToMarketClass(marketQuery.data, numerators, getRegisteredToken);
  }, [marketQuery.data, numeratorsQuery.data, registeredTokens, getRegisteredToken]);

  const refresh = () => {
    if (currentPrizeAddress) {
      queryClient.invalidateQueries({ queryKey: pmQueryKeys.marketByPrizeAddress(currentPrizeAddress) });
    }
  };

  return {
    gameMarket,
    isLoading: marketQuery.isLoading || (!!marketQuery.data && numeratorsQuery.isLoading),
    refresh,
    currentPrizeAddress,
    hasMarket: !!gameMarket,
  };
};
