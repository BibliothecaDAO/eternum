import { SortInterface } from "@/ui/design-system/atoms/sort-button"; // Assuming SortInterface is exported from here
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { create } from "zustand";

interface SocialState {
  selectedTab: number;
  isExpanded: boolean;
  isRegisterLoading: boolean;
  isSharePointsLoading: boolean;
  isUpdatePointsLoading: boolean;
  selectedGuild: ContractAddress;
  selectedPlayer: ContractAddress;
  playersByRank: [ContractAddress, number][];
  playerInfo: PlayerInfo[];
  // Guilds specific state
  guildsViewGuildInvites: boolean;
  guildsGuildSearchTerm: string;
  guildsActiveSort: SortInterface;

  setSelectedTab: (tab: number) => void;
  setIsExpanded: (expanded: boolean) => void;
  setIsRegisterLoading: (loading: boolean) => void;
  setIsSharePointsLoading: (loading: boolean) => void;
  setIsUpdatePointsLoading: (loading: boolean) => void;
  setSelectedGuild: (guild: ContractAddress) => void;
  setSelectedPlayer: (player: ContractAddress) => void;
  setPlayersByRank: (players: [ContractAddress, number][]) => void;
  setPlayerInfo: (info: PlayerInfo[]) => void;
  // Guilds specific setters
  setGuildsViewGuildInvites: (view: boolean) => void;
  setGuildsGuildSearchTerm: (term: string) => void;
  setGuildsActiveSort: (sort: SortInterface) => void;
}

const initialGuildsActiveSort: SortInterface = {
  sortKey: "rank",
  sort: "asc",
};

export const useSocialStore = create<SocialState>((set) => ({
  selectedTab: 0,
  isExpanded: false,
  isRegisterLoading: false,
  isSharePointsLoading: false,
  isUpdatePointsLoading: false,
  selectedGuild: 0n as ContractAddress,
  selectedPlayer: 0n as ContractAddress,
  playersByRank: [],
  playerInfo: [],
  // Guilds specific state initial values
  guildsViewGuildInvites: false,
  guildsGuildSearchTerm: "",
  guildsActiveSort: initialGuildsActiveSort,

  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setIsExpanded: (expanded) => set({ isExpanded: expanded }),
  setIsRegisterLoading: (loading) => set({ isRegisterLoading: loading }),
  setIsSharePointsLoading: (loading) => set({ isSharePointsLoading: loading }),
  setIsUpdatePointsLoading: (loading) => set({ isUpdatePointsLoading: loading }),
  setSelectedGuild: (guild) => set({ selectedGuild: guild }),
  setSelectedPlayer: (player) => set({ selectedPlayer: player }),
  setPlayersByRank: (players) => set({ playersByRank: players }),
  setPlayerInfo: (info) => set({ playerInfo: info }),
  // Guilds specific setters implementation
  setGuildsViewGuildInvites: (view) => set({ guildsViewGuildInvites: view }),
  setGuildsGuildSearchTerm: (term) => set({ guildsGuildSearchTerm: term }),
  setGuildsActiveSort: (sort) => set({ guildsActiveSort: sort }),
}));