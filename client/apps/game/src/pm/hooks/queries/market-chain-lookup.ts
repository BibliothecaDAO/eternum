import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";

import { getPmSqlApiForUrl, type MarketWithDetailsRow } from "./pm-sql-api";

export type MarketDataChain = keyof typeof GLOBAL_TORII_BY_CHAIN;

type MarketLookupFailure = {
  chain: MarketDataChain;
  error: unknown;
};

type MarketLookupResult = {
  chain: MarketDataChain | null;
  failures: MarketLookupFailure[];
  marketRow: MarketWithDetailsRow | null;
};

const resolveMarketLookupChains = (preferredChain: MarketDataChain): MarketDataChain[] => {
  return preferredChain === "mainnet" ? ["mainnet", "slot"] : ["slot", "mainnet"];
};

export const findMarketByPrizeAddressAcrossChains = async ({
  onChainError,
  preferredChain,
  prizeAddress,
}: {
  onChainError?: (failure: MarketLookupFailure) => void;
  preferredChain: MarketDataChain;
  prizeAddress: string;
}): Promise<MarketLookupResult> => {
  const failures: MarketLookupFailure[] = [];

  for (const chain of resolveMarketLookupChains(preferredChain)) {
    try {
      const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]);
      const marketRow = await api.fetchMarketByPrizeAddress(prizeAddress);
      if (marketRow) {
        return {
          chain,
          failures,
          marketRow,
        };
      }
    } catch (error) {
      const failure = { chain, error };
      failures.push(failure);
      onChainError?.(failure);
    }
  }

  return {
    chain: null,
    failures,
    marketRow: null,
  };
};
