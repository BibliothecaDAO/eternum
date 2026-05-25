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

const alternateChainOf = (chain: MarketDataChain): MarketDataChain => (chain === "mainnet" ? "slot" : "mainnet");

/**
 * Look up a prediction market by its prize-distribution address, starting from the preferred chain.
 *
 * A `null` result on the preferred chain means the market genuinely doesn't exist there
 * and we do NOT probe the alternate chain. The alternate is only tried when the preferred
 * chain throws (network/gateway error) — and only when `fallbackOnError` is true (default).
 *
 * This avoids the redundant cross-chain fan-out that was overwhelming PM Torii (504s).
 */
export const findMarketByPrizeAddressAcrossChains = async ({
  onChainError,
  preferredChain,
  prizeAddress,
  fallbackOnError = true,
}: {
  onChainError?: (failure: MarketLookupFailure) => void;
  preferredChain: MarketDataChain;
  prizeAddress: string;
  fallbackOnError?: boolean;
}): Promise<MarketLookupResult> => {
  const failures: MarketLookupFailure[] = [];

  try {
    const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[preferredChain]);
    const marketRow = await api.fetchMarketByPrizeAddress(prizeAddress);
    if (marketRow) {
      return { chain: preferredChain, failures, marketRow };
    }
    return { chain: null, failures, marketRow: null };
  } catch (error) {
    const failure = { chain: preferredChain, error };
    failures.push(failure);
    onChainError?.(failure);
  }

  if (!fallbackOnError) {
    return { chain: null, failures, marketRow: null };
  }

  const alternate = alternateChainOf(preferredChain);
  try {
    const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[alternate]);
    const marketRow = await api.fetchMarketByPrizeAddress(prizeAddress);
    if (marketRow) {
      return { chain: alternate, failures, marketRow };
    }
  } catch (error) {
    const failure = { chain: alternate, error };
    failures.push(failure);
    onChainError?.(failure);
  }

  return { chain: null, failures, marketRow: null };
};
