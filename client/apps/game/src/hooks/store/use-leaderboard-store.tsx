import { useDojo } from "@/hooks/context/DojoContext";
import { useGuilds } from "@/hooks/helpers/use-guilds";
import useNextBlockTimestamp from "@/hooks/use-next-block-timestamp";
import { ContractAddress, ID, LeaderboardManager } from "@bibliothecadao/eternum";
import { useCallback } from "react";
import { create } from "zustand";

interface LeaderboardStore {
  playersByRank: [ContractAddress, number][];
  setPlayersByRank: (val: [ContractAddress, number][]) => void;
  guildsByRank: [ID, number][];
  setGuildsByRank: (val: [ID, number][]) => void;
}

export const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    playersByRank: [],
    setPlayersByRank: (val: [ContractAddress, number][]) => set({ playersByRank: val }),
    guildsByRank: [],
    setGuildsByRank: (val: [ID, number][]) => set({ guildsByRank: val }),
  };
});

export const useHyperstructureData = () => {
  const dojo = useDojo();

  const { getGuildFromPlayerAddress } = useGuilds();

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const setPlayersByRank = useLeaderBoardStore((state) => state.setPlayersByRank);
  const setGuildsByRank = useLeaderBoardStore((state) => state.setGuildsByRank);

  const updateLeaderboard = useCallback(() => {
    const leaderboardManager = LeaderboardManager.instance(dojo.setup.components);
    const playersByRank = leaderboardManager.getPlayersByRank(nextBlockTimestamp || 0);
    const guildsByRank = leaderboardManager.getGuildsByRank(nextBlockTimestamp || 0, getGuildFromPlayerAddress);
    setPlayersByRank(playersByRank);
    setGuildsByRank(guildsByRank);
  }, [dojo, nextBlockTimestamp, getGuildFromPlayerAddress, setPlayersByRank, setGuildsByRank]);

  return updateLeaderboard;
};
