import { ClientComponents } from "@/dojo/createClientComponents";
import { HyperstructureEventInterface, getHyperstructureEvents } from "@/dojo/events/hyperstructureEventQueries";
import { displayAddress, sortItems } from "@/ui/utils/utils";
import {
  ContractAddress,
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  ID,
  ConfigManager
  ResourcesIds,
  getOrderName,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useContributions } from "../helpers/useContributions";
import { useGuilds } from "../helpers/useGuilds";
import { useRealm } from "../helpers/useRealm";
import useBlockchainStore from "../store/useBlockchainStore";

function getResourceMultiplier(resourceType: ResourcesIds): number {
  const configManager = ConfigManager.instance();

  return configManager.getConfig().ResourceMultipliers[resourceType];
}

function computeContributionPoints(totalPoints: number, qty: number, resourceType: ResourcesIds): number {
  const configManager = ConfigManager.instance();
  const totalContributableAmount = configManager.getTotalContributableAmount();
  const resourcePrecision = configManager.getResourcePrecision();

  const effectiveContribution = (qty / resourcePrecision) * getResourceMultiplier(resourceType);
  const points = (effectiveContribution / totalContributableAmount) * totalPoints;
  return points;
}

export const calculateShares = (contributions: any[]) => {
  let points = 0;
  contributions.forEach((contribution) => {
    points += computeContributionPoints(1, Number(contribution.amount), contribution.resource_type);
  });
  return points;
};

interface Rankable {
  totalPoints: number;
  rank: number;
}
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
  loading: boolean;
  playerPointsLeaderboard: PlayerPointsLeaderboardInterface[];
  guildPointsLeaderboard: GuildPointsLeaderboardInterface[];
  finishedHyperstructures: HyperstructureEventInterface[];
  setLoading: (loading: boolean) => void;
  setPlayerPointsLeaderboards: (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]) => void;
  setGuildPointsLeaderboards: (guildPointsLeaderboard: GuildPointsLeaderboardInterface[]) => void;
  setFinishedHyperstructures: (val: HyperstructureEventInterface[]) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    loading: false,
    playerPointsLeaderboard: [],
    guildPointsLeaderboard: [],
    finishedHyperstructures: [],
    setLoading: (loading) => set({ loading }),
    setPlayerPointsLeaderboards: (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]) =>
      set({ playerPointsLeaderboard: playerPointsLeaderboard }),
    setGuildPointsLeaderboards: (guildPointsLeaderboard: GuildPointsLeaderboardInterface[]) =>
      set({ guildPointsLeaderboard: guildPointsLeaderboard }),
    setFinishedHyperstructures: (val: HyperstructureEventInterface[]) => set({ finishedHyperstructures: val }),
  };
});

export const useComputePointsLeaderboards = () => {
  const configManager = ConfigManager.instance();
  const defaultTickIntervalInSeconds = configManager.getConfig().tick.defaultTickIntervalInSeconds;
  const hyperstructurePointsPerCycle = configManager.getConfig().hyperstructurePointsPerCycle;

  const setPlayerPointsLeaderboards = useLeaderBoardStore((state) => state.setPlayerPointsLeaderboards);
  const setGuildPointsLeaderboards = useLeaderBoardStore((state) => state.setGuildPointsLeaderboards);

  const { getContributions } = useContributions();
  const { getAddressGuild } = useGuilds();
  const { getAddressName, getAddressOrder } = useRealm();

  const {
    account: { account },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const updatePlayerPointsLeaderboard = useCallback(
    (
      hyperstructureEntityId: ID,
      finishedTimestamp: number,
      currentTimestamp: number,
    ): PlayerPointsLeaderboardInterface[] => {
      const contributions = getContributions(hyperstructureEntityId);
      const nbOfCycles = Math.floor((currentTimestamp - finishedTimestamp) / defaultTickIntervalInSeconds);
      const totalHyperstructurePoints = hyperstructurePointsPerCycle * nbOfCycles;

      return computeHyperstructureLeaderboard(
        contributions,
        totalHyperstructurePoints,
        account,
        getAddressName,
        getAddressOrder,
      );
    },
    [getContributions],
  );

  const updateGuildPointsLeaderboard = useCallback(
    (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]): GuildPointsLeaderboardInterface[] => {
      let tempGuildPointsLeaderboard: GuildPointsLeaderboardInterface[] = [];
      playerPointsLeaderboard.forEach((player) => {
        const { guildName, userGuildEntityId } = getAddressGuild(player.address);

        if (userGuildEntityId) {
          const index = tempGuildPointsLeaderboard.findIndex((guild) => guild.guildEntityId === userGuildEntityId);
          if (index >= 0) {
            tempGuildPointsLeaderboard[index].totalPoints += player.totalPoints;
          } else {
            tempGuildPointsLeaderboard.push({
              guildEntityId: userGuildEntityId!,
              name: guildName!,
              totalPoints: player.totalPoints,
              isYours: player.address === ContractAddress(account.address),
              rank: 0,
            });
          }
        }
      });

      return setRanks(tempGuildPointsLeaderboard);
    },
    [getContributions],
  );

  useEffect(() => {
    if (!nextBlockTimestamp) return;

    getHyperstructureEvents().then((events) => {
      let _tmpPlayerPointsLeaderboard;
      let _tmpGuildPointsLeaderboard;
      events.forEach((event) => {
        const { hyperstructureEntityId, timestamp } = event;
        _tmpPlayerPointsLeaderboard = updatePlayerPointsLeaderboard(
          hyperstructureEntityId,
          timestamp,
          nextBlockTimestamp,
        );
        _tmpGuildPointsLeaderboard = updateGuildPointsLeaderboard(_tmpPlayerPointsLeaderboard);
      });
      _tmpPlayerPointsLeaderboard && setPlayerPointsLeaderboards(_tmpPlayerPointsLeaderboard);
      _tmpGuildPointsLeaderboard && setGuildPointsLeaderboards(_tmpGuildPointsLeaderboard);
    });
  }, [nextBlockTimestamp]);
};

export default useLeaderBoardStore;

const computeHyperstructureLeaderboard = (
  contributions: (ComponentValue<ClientComponents["Contribution"]["schema"]> | undefined)[],
  totalHyperstructurePoints: number,
  account: any,
  getAddressName: (address: ContractAddress) => string | undefined,
  getAddressOrder: (address: ContractAddress) => number | undefined,
): PlayerPointsLeaderboardInterface[] => {
  let tempPlayerPointsLeaderboard: PlayerPointsLeaderboardInterface[] = [];

  if (!Array.isArray(contributions)) {
    console.error("Contributions is not an array:", contributions);
    return tempPlayerPointsLeaderboard;
  }

  contributions.forEach((contribution) => {
    const index = tempPlayerPointsLeaderboard.findIndex((player) => player.address === contribution!.player_address);
    if (index >= 0) {
      tempPlayerPointsLeaderboard[index].totalPoints += computeContributionPoints(
        totalHyperstructurePoints,
        Number(contribution!.amount),
        contribution!.resource_type,
      );
    } else {
      tempPlayerPointsLeaderboard.push({
        address: contribution!.player_address,
        addressName:
          getAddressName(contribution!.player_address) || displayAddress(contribution!.player_address.toString(16)),
        order: getOrderName(getAddressOrder(contribution!.player_address) || 1),
        totalPoints: computeContributionPoints(
          totalHyperstructurePoints,
          Number(contribution!.amount),
          contribution!.resource_type,
        ),
        isYours: contribution!.player_address === account.address,
        rank: 0,
      });
    }
  });
  return setRanks(tempPlayerPointsLeaderboard);
};

function setRanks<T extends Rankable>(leaderboard: T[]): T[] {
  const leaderboardSortedByRank = sortItems(leaderboard, { sortKey: "totalPoints", sort: "desc" });
  leaderboardSortedByRank.forEach((item, index) => (item.rank = index + 1));
  return leaderboardSortedByRank;
}
