import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";
import { getPmSqlApiForUrl, pmQueryKeys } from "@/pm/hooks/queries";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { useConfig } from "@/pm/providers";
import { dojoConfig } from "../../../../../dojo-config";
import { normalizeHexAddress, transformMarketRowToClass } from "./transform-market-row";

type MarketDataChain = "slot" | "mainnet";

/**
 * Hook that finds the prediction market associated with the current game.
 * Optimized to query directly by prize address instead of fetching all markets.
 */
export const useCurrentGameMarket = () => {
  const { manifest } = dojoConfig;
  const { registeredTokens, getRegisteredToken } = useConfig();
  const queryClient = useQueryClient();
  const preferredChain = getPredictionMarketChain();
  const chainsToCheck = useMemo<MarketDataChain[]>(
    () => (preferredChain === "mainnet" ? ["mainnet", "slot"] : ["slot", "mainnet"]),
    [preferredChain],
  );

  // Get current game's prize distribution contract address from manifest
  const currentPrizeAddress = useMemo(() => {
    const contracts = manifest?.contracts;
    if (!Array.isArray(contracts)) return null;

    const prizeContract = contracts.find((c: { tag?: string }) => c.tag === "s1_eternum-prize_distribution_systems");
    return prizeContract?.address ? normalizeHexAddress(prizeContract.address) : null;
  }, [manifest]);

  // Fetch market directly by prize address (optimized - single market query)
  const marketQuery = useQuery({
    queryKey: pmQueryKeys.marketByPrizeAddress(currentPrizeAddress ?? "", preferredChain),
    queryFn: async () => {
      if (!currentPrizeAddress) return { marketRow: null, chain: null as MarketDataChain | null };
      for (const chain of chainsToCheck) {
        const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]);
        const result = await api.fetchMarketByPrizeAddress(currentPrizeAddress);
        if (result) {
          return { marketRow: result, chain };
        }
      }
      console.debug("[useCurrentGameMarket] No market found for prize address:", currentPrizeAddress);
      return { marketRow: null, chain: null as MarketDataChain | null };
    },
    enabled: !!currentPrizeAddress && registeredTokens.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch numerators for the market if found
  const numeratorsQuery = useQuery({
    queryKey: pmQueryKeys.marketNumerators(
      marketQuery.data?.marketRow ? [marketQuery.data.marketRow.market_id] : [],
      (marketQuery.data?.chain ?? preferredChain) as MarketDataChain,
    ),
    queryFn: async () => {
      if (!marketQuery.data?.marketRow || !marketQuery.data.chain) return [];
      const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[marketQuery.data.chain]);
      return api.fetchVaultNumeratorsByMarkets([marketQuery.data.marketRow.market_id]);
    },
    enabled: !!marketQuery.data?.marketRow && !!marketQuery.data?.chain,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Transform to MarketClass
  const gameMarket = useMemo(() => {
    if (!marketQuery.data?.marketRow || !registeredTokens.length) return null;
    const numerators = numeratorsQuery.data ?? [];
    return transformMarketRowToClass(marketQuery.data.marketRow, numerators, getRegisteredToken);
  }, [marketQuery.data, numeratorsQuery.data, registeredTokens, getRegisteredToken]);

  const refresh = () => {
    if (currentPrizeAddress) {
      queryClient.invalidateQueries({
        queryKey: pmQueryKeys.marketByPrizeAddress(currentPrizeAddress, preferredChain),
      });
    }
  };

  return {
    gameMarket,
    marketChain: marketQuery.data?.chain ?? null,
    isLoading: marketQuery.isLoading || (!!marketQuery.data?.marketRow && numeratorsQuery.isLoading),
    refresh,
    currentPrizeAddress,
    hasMarket: !!gameMarket,
  };
};
