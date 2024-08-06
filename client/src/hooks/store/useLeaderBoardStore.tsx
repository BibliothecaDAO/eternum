import { HyperstructureFinishedEvent } from "@/dojo/modelManager/LeaderboardManager";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { create } from "zustand";

export interface PlayerPointsLeaderboardInterface {
  address: ContractAddress;
  addressName: string;
  order: string;
  totalPoints: number;
  isYours: boolean;
  rank: number;
}

export interface GuildPointsLeaderboardInterface {
  guildEntityId: ID;
  name: string;
  totalPoints: number;
  isYours: boolean;
  rank: number;
}

interface LeaderboardStore {
  finishedHyperstructures: HyperstructureFinishedEvent[];
  setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => void;
}

export const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    finishedHyperstructures: [],
    setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => set({ finishedHyperstructures: val }),
  };
});
