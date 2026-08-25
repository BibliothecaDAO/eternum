import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import type { Chain } from "@contracts";
import { getRpcUrlForChain } from "@/runtime/chain-rpc";
import { useQuery } from "@tanstack/react-query";

export interface JackpotInput {
  chain: Chain;
  feeTokenAddress: string;
  prizeDistributionAddress: string;
}

/**
 * Call `balance_of(prizeDistributionAddress)` on the fee-token contract.
 * Returns 0n on error or if the payload is too short.
 */
export async function fetchJackpotBalance({
  chain,
  feeTokenAddress,
  prizeDistributionAddress,
}: JackpotInput): Promise<bigint> {
  try {
    const provider = getCachedRpcProvider(getRpcUrlForChain(chain));
    const result = await provider.callContract({
      contractAddress: feeTokenAddress,
      entrypoint: "balance_of",
      calldata: [prizeDistributionAddress],
    });
    if (!Array.isArray(result) || result.length < 2) return 0n;
    const low = BigInt(result[0] ?? 0);
    const high = BigInt(result[1] ?? 0);
    return low + (high << 128n);
  } catch {
    return 0n;
  }
}

interface UseWorldJackpotInput {
  chain: Chain;
  feeTokenAddress: string | null;
  prizeDistributionAddress: string | null;
  /** Gate — defaults to true. Use to defer the fetch until card is expanded/visible. */
  enabled?: boolean;
}

/**
 * On-demand jackpot balance query. The prize distribution address is assumed already resolved
 * (e.g. via the worlds summary endpoint), so this hook only does the RPC `balance_of` call.
 *
 * The worlds summary now carries a server-resolved `winnerJackpotAmount`; prefer that and use
 * this hook only as a fallback when the summary value is null.
 *
 * Cached for 60s; not refetched on a timer — callers can call `refetch` if needed.
 */
export const useWorldJackpot = ({
  chain,
  feeTokenAddress,
  prizeDistributionAddress,
  enabled = true,
}: UseWorldJackpotInput) => {
  const canFetch = enabled && Boolean(feeTokenAddress) && Boolean(prizeDistributionAddress);

  return useQuery({
    queryKey: ["worldJackpot", chain, prizeDistributionAddress ?? "none", feeTokenAddress ?? "none"],
    queryFn: () =>
      fetchJackpotBalance({
        chain,
        feeTokenAddress: feeTokenAddress!,
        prizeDistributionAddress: prizeDistributionAddress!,
      }),
    enabled: canFetch,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
