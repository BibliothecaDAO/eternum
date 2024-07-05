import { HyperstructureEventInterface, getHyperstructureEvents } from "@/dojo/events/hyperstructureEventQueries";
import { displayAddress, sortItems } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  ResourcesIds,
  getOrderName,
} from "@bibliothecadao/eternum";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useContributions } from "../helpers/useContributions";
import { useGuilds } from "../helpers/useGuilds";
import { useRealm } from "../helpers/useRealm";
import useBlockchainStore from "../store/useBlockchainStore";

export const ResourceMultipliers: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 1.0,
  [ResourcesIds.Stone]: 1.27,
  [ResourcesIds.Coal]: 1.31,
  [ResourcesIds.Copper]: 1.9,
  [ResourcesIds.Obsidian]: 2.26,
  [ResourcesIds.Silver]: 2.88,
  [ResourcesIds.Ironwood]: 4.25,
  [ResourcesIds.ColdIron]: 5.24,
  [ResourcesIds.Gold]: 5.49,
  [ResourcesIds.Hartwood]: 8.44,
  [ResourcesIds.Diamonds]: 16.72,
  [ResourcesIds.Sapphire]: 20.3,
  [ResourcesIds.Ruby]: 20.98,
  [ResourcesIds.DeepCrystal]: 20.98,
  [ResourcesIds.Ignium]: 29.15,
  [ResourcesIds.EtherealSilica]: 30.95,
  [ResourcesIds.TrueIce]: 36.06,
  [ResourcesIds.TwilightQuartz]: 45.18,
  [ResourcesIds.AlchemicalSilver]: 53.92,
  [ResourcesIds.Adamantine]: 91.2,
  [ResourcesIds.Mithral]: 135.53,
  [ResourcesIds.Dragonhide]: 217.92,
  [ResourcesIds.Earthenshard]: 20.98,
};

export let TOTAL_CONTRIBUTABLE_AMOUNT: number = 0;
HYPERSTRUCTURE_TOTAL_COSTS_SCALED.forEach(({ resource, amount }) => {
  TOTAL_CONTRIBUTABLE_AMOUNT += ResourceMultipliers[resource as keyof typeof ResourceMultipliers]! * amount;
});

function getResourceMultiplier(resourceType: BigInt): number {
  const resourceTypeNumber: ResourcesIds = Number(resourceType);
  return ResourceMultipliers[resourceTypeNumber] ?? 0;
}

export function computeContributionPoints(totalPoints: number, qty: number, resourceType: BigInt): number {
  const effectiveContribution =
    (qty / EternumGlobalConfig.resources.resourcePrecision) * getResourceMultiplier(resourceType);
  const points = (effectiveContribution / TOTAL_CONTRIBUTABLE_AMOUNT) * totalPoints;
  return points;
}

export const calculateShares = (contributions: any[]) => {
  let points = 0;
  contributions.forEach((contribution) => {
    points += computeContributionPoints(1, Number(contribution.amount), BigInt(contribution.resource_type));
  });
  return points;
};

interface Rankable {
  totalPoints: number;
  rank: number;
}
export interface PlayerPointsLeaderboardInterface {
  address: string;
  addressName: string;
  order: string;
  totalPoints: number;
  isYours: boolean;
  rank: number;
}

export interface GuildPointsLeaderboardInterface {
  guildEntityId: bigint;
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
  const playerPointsLeaderboards = useLeaderBoardStore((state) => state.playerPointsLeaderboard);
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
      playerPointsLeaderboards: PlayerPointsLeaderboardInterface[],
      hyperstructureEntityId: bigint,
      finishedTimestamp: number,
      currentTimestamp: number,
    ): PlayerPointsLeaderboardInterface[] => {
      const contributions = getContributions(hyperstructureEntityId);

      const nbOfCycles = Math.floor(
        (currentTimestamp - finishedTimestamp) / EternumGlobalConfig.tick.defaultTickIntervalInSeconds,
      );
      let totalHyperstructurePoints = HYPERSTRUCTURE_POINTS_PER_CYCLE * nbOfCycles;

      return computeHyperstructureLeaderboard(
        playerPointsLeaderboards,
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
              isYours: player.address === account.address,
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
          playerPointsLeaderboards,
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

export const computeHyperstructureLeaderboard = (
  playerPointsLeaderboards: PlayerPointsLeaderboardInterface[],
  contributions: any[],
  totalHyperstructurePoints: number,
  account: any,
  getAddressName: any,
  getAddressOrder: any,
): PlayerPointsLeaderboardInterface[] => {
  let tempPlayerPointsLeaderboard: PlayerPointsLeaderboardInterface[] = playerPointsLeaderboards;

  if (!Array.isArray(contributions)) {
    console.error("Contributions is not an array:", contributions);
    return tempPlayerPointsLeaderboard;
  }

  contributions.forEach((contribution) => {
    const playerAddress: string = "0x" + contribution!.player_address.toString(16);
    const index = tempPlayerPointsLeaderboard.findIndex((player) => player.address === playerAddress);
    if (index >= 0) {
      tempPlayerPointsLeaderboard[index].totalPoints += computeContributionPoints(
        totalHyperstructurePoints,
        Number(contribution!.amount),
        BigInt(contribution!.resource_type),
      );
    } else {
      tempPlayerPointsLeaderboard.push({
        address: playerAddress,
        addressName: getAddressName(playerAddress) || displayAddress(playerAddress),
        order: getOrderName(getAddressOrder(playerAddress) || 1),
        totalPoints: computeContributionPoints(
          totalHyperstructurePoints,
          Number(contribution!.amount),
          BigInt(contribution!.resource_type),
        ),
        isYours: playerAddress === account.address,
        rank: 0,
      });
    }
  });

  setRanks(tempPlayerPointsLeaderboard);
  return tempPlayerPointsLeaderboard;
};

function setRanks<T extends Rankable>(leaderboard: T[]): T[] {
  const leaderboardSortedByRank = sortItems(leaderboard, { sortKey: "totalPoints", sort: "desc" });
  leaderboardSortedByRank.forEach((item, index) => (item.rank = index + 1));
  return leaderboardSortedByRank;
}
