import { fetchPlaytestSlots } from "@/ui/features/factory-v2/api/factory-worker";
import { useQuery } from "@tanstack/react-query";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
export const BLITZ_SEATS = nativeRuleConstants.MAX_BLITZ_ROSTER_PLAYERS;
export const usePlaytestSlots = () =>
  useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3000 });
