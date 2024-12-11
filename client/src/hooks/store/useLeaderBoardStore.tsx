import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useCallback } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useGuilds } from "../helpers/useGuilds";
import useNextBlockTimestamp from "../useNextBlockTimestamp";

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
    const leaderboardManager = LeaderboardManager.instance(dojo);
    const playersByRank = leaderboardManager.getPlayersByRank(nextBlockTimestamp || 0);
    const guildsByRank = leaderboardManager.getGuildsByRank(nextBlockTimestamp || 0, getGuildFromPlayerAddress);
    setPlayersByRank(playersByRank);
    setGuildsByRank(guildsByRank);
  }, [dojo, nextBlockTimestamp, getGuildFromPlayerAddress, setPlayersByRank, setGuildsByRank]);

  return updateLeaderboard;
};
