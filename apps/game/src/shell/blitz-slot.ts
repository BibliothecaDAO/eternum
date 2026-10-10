import { fetchPlaytestSlots } from "@/ui/features/factory-v2/api/factory-worker";
import { useQuery } from "@tanstack/react-query";

/** A Blitz game's roster. */
export const BLITZ_SEATS = 24;

export const usePlaytestSlots = () =>
  useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });
