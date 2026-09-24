import { useAccountStore } from "@/hooks/store/use-account-store";
import { fetchGameReviewData } from "@/services/review/game-review-service";
import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";

interface UseGameReviewDataOptions {
  game: GameRef | null;
  worldName?: string;
  enabled?: boolean;
}

export const useGameReviewData = ({ game, worldName, enabled = true }: UseGameReviewDataOptions) => {
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  return useQuery({
    queryKey: ["gameReview", game?.chainId ?? "", game?.gameId ?? 0, playerAddress ?? "anonymous"],
    queryFn: () => fetchGameReviewData({ game: game!, worldName: worldName ?? "", playerAddress }),
    enabled: enabled && Boolean(game),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
};
