import { ContractAddress, getGuildFromPlayerAddress, ID, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useCallback } from "react";
import { create } from "zustand";
import { useBlockTimestamp } from "../helpers/use-block-timestamp";

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

  const { currentBlockTimestamp } = useBlockTimestamp();

  const setPlayersByRank = useLeaderBoardStore((state) => state.setPlayersByRank);
  const setGuildsByRank = useLeaderBoardStore((state) => state.setGuildsByRank);

  const updateLeaderboard = useCallback(() => {
    const leaderboardManager = LeaderboardManager.instance(dojo.setup.components);
    const playersByRank = leaderboardManager.getPlayersByRank(currentBlockTimestamp || 0);
    const guildsByRank = leaderboardManager.getGuildsByRank(currentBlockTimestamp || 0);
    setPlayersByRank(playersByRank);
    setGuildsByRank(guildsByRank);
  }, [dojo, currentBlockTimestamp, getGuildFromPlayerAddress, setPlayersByRank, setGuildsByRank]);

  return updateLeaderboard;
};
