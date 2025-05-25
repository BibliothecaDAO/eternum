import { useQuery } from "@tanstack/react-query";
import {
  fetchDonkeyBurn,
  fetchSeasonDay,
  fetchTotalAgents,
  fetchTotalBattles,
  fetchTotalCreatedAgents,
  fetchTotalGuilds,
  fetchTotalPlayers,
  fetchTotalStructures,
  fetchTotalTransactions,
  fetchTotalTroops,
} from "./services";

export const useData = () => {
  const { data, isLoading: isLoadingDonkeyBurn } = useQuery({
    queryKey: ["donkeyBurn"],
    queryFn: () => fetchDonkeyBurn(),
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });

  const { data: seasonDay, isLoading: isLoadingSeasonDay } = useQuery({
    queryKey: ["seasonDay"],
    queryFn: () => fetchSeasonDay(),
    refetchInterval: 1000 * 60 * 60, // 1 hour
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

  const { data: totalPlayers, isLoading: isLoadingTotalPlayers } = useQuery({
    queryKey: ["totalPlayers"],
    queryFn: () => fetchTotalPlayers(),
  });

  const { data: totalTransactions, isLoading: isLoadingTotalTransactions } = useQuery({
    queryKey: ["totalTransactions"],
    queryFn: () => fetchTotalTransactions(),
  });

  const isLoading = [
    isLoadingDonkeyBurn,
    isLoadingSeasonDay,
    isLoadingTotalGuilds,
    isLoadingTotalStructures,
    isLoadingTotalTroops,
    isLoadingTotalBattles,
    isLoadingTotalAgents,
    isLoadingTotalCreatedAgents,
    isLoadingTotalPlayers,
    isLoadingTotalTransactions,
  ].some(Boolean);

  return {
    donkeyBurn: data,
    seasonDay,
    totalGuilds,
    totalStructures,
    totalTroops,
    totalBattles,
    totalAgents,
    totalCreatedAgents,
    totalPlayers,
    totalTransactions,
    isLoading,
  };
};
