import { useAccountStore } from "@/hooks/store/use-account-store";
import { fetchGameReviewData } from "@/services/review/game-review-service";
import type { Chain } from "@contracts";
import { useQuery } from "@tanstack/react-query";

interface UseGameReviewDataOptions {
  worldName?: string;
  chain?: Chain;
  enabled?: boolean;
}

export const useGameReviewData = ({ worldName, chain, enabled = true }: UseGameReviewDataOptions) => {
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  return useQuery({
    queryKey: ["gameReview", chain ?? "unknown", worldName ?? "", playerAddress ?? "anonymous"],
    queryFn: () =>
      fetchGameReviewData({
        worldName: worldName!,
        chain: chain!,
        playerAddress,
      }),
    enabled: enabled && Boolean(worldName) && Boolean(chain),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
};
