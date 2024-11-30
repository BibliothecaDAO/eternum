import { useGetAllPlayers } from "@/hooks/use-get-all-players";
import { LeaderboardPanel } from "./leaderboard-panel";

export const Leaderboard = () => {
  const getPlayers = useGetAllPlayers();

  return <LeaderboardPanel players={getPlayers()} />;
};
