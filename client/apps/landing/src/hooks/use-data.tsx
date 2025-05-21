import { useQuery } from "@tanstack/react-query";
import {
  fetchDonkeyBurn,
  fetchTotalAgents,
  fetchTotalBattles,
  fetchTotalCreatedAgents,
  fetchTotalGuilds,
  fetchTotalStructures,
  fetchTotalTroops,
} from "./services";

export const useData = () => {
  const { data, isLoading: isLoadingDonkeyBurn } = useQuery({
    queryKey: ["donkeyBurn"],
    queryFn: () => fetchDonkeyBurn(),
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });

  const { data: totalGuilds, isLoading: isLoadingTotalGuilds } = useQuery({
    queryKey: ["totalGuilds"],
    queryFn: () => fetchTotalGuilds(),
  });

  const { data: totalStructures, isLoading: isLoadingTotalStructures } = useQuery({
    queryKey: ["totalStructures"],
    queryFn: () => fetchTotalStructures(),
  });

  const { data: totalTroops, isLoading: isLoadingTotalTroops } = useQuery({
    queryKey: ["totalTroops"],
    queryFn: () => fetchTotalTroops(),
  });

  const { data: totalBattles, isLoading: isLoadingTotalBattles } = useQuery({
    queryKey: ["totalBattles"],
    queryFn: () => fetchTotalBattles(),
  });

  const { data: totalAgents, isLoading: isLoadingTotalAgents } = useQuery({
    queryKey: ["totalAgents"],
    queryFn: () => fetchTotalAgents(),
  });

  const { data: totalCreatedAgents, isLoading: isLoadingTotalCreatedAgents } = useQuery({
    queryKey: ["totalCreatedAgents"],
    queryFn: () => fetchTotalCreatedAgents(),
  });

  const isLoading = [
    isLoadingDonkeyBurn,
    isLoadingTotalGuilds,
    isLoadingTotalStructures,
    isLoadingTotalTroops,
    isLoadingTotalBattles,
    isLoadingTotalAgents,
    isLoadingTotalCreatedAgents,
  ].some(Boolean);

  return {
    donkeyBurn: data,
    totalGuilds,
    totalStructures,
    totalTroops,
    totalBattles,
    totalAgents,
    totalCreatedAgents,
    isLoading,
  };
};
