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

/**
 * Look up a prediction market by its prize-distribution address.
 *
 * Prediction markets now live on a single chain (mainnet), so there is no
 * cross-chain fan-out: a `null` result means the market genuinely doesn't
 * exist, and a throw is surfaced as a failure entry.
 */
export const findMarketByPrizeAddressAcrossChains = async ({
  onChainError,
  preferredChain,
  prizeAddress,
}: {
  onChainError?: (failure: MarketLookupFailure) => void;
  preferredChain: MarketDataChain;
  prizeAddress: string;
  /** @deprecated retained for call-site compatibility; there is no alternate chain to fall back to. */
  fallbackOnError?: boolean;
}): Promise<MarketLookupResult> => {
  const failures: MarketLookupFailure[] = [];

  try {
    const api = getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[preferredChain]);
    const marketRow = await api.fetchMarketByPrizeAddress(prizeAddress);
    if (marketRow) {
      return { chain: preferredChain, failures, marketRow };
    }
  } catch (error) {
    const failure = { chain: preferredChain, error };
    failures.push(failure);
    onChainError?.(failure);
  }

  return { chain: null, failures, marketRow: null };
};
