import { EternumGlobalConfig, HYPERSTRUCTURE_TOTAL_COSTS_SCALED, getOrderName } from "@bibliothecadao/eternum";
import { create } from "zustand";

import useBlockchainStore from "../store/useBlockchainStore";
import { useContributions } from "../helpers/useContributions";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { getHyperstructureEvents } from "@/dojo/events/hyperstructureEventQueries";
import { useCallback, useEffect, useState } from "react";
import { useRealm } from "../helpers/useRealm";
import { displayAddress } from "@/ui/utils/utils";
import { useDojo } from "../context/DojoContext";

// Define elsewhere
const PTS_PER_CYCLE = 100;

// Computed based on qty of 10 of each resource for hyperstructure building
const TOTAL_EFFECTIVE_CONTRIBUTION = 8209.1;

// fix ?
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

export let TOTAL_CONTRIBUTABLE_AMOUNT: number;
HYPERSTRUCTURE_TOTAL_COSTS_SCALED.forEach(({ resource, amount }) => {
  TOTAL_CONTRIBUTABLE_AMOUNT += ResourceMultipliers[resource as keyof typeof ResourceMultipliers]! * amount;
});

function getResourceMultiplier(resourceType: BigInt): number {
  const resourceTypeNumber: ResourcesIds = Number(resourceType);
  return ResourceMultipliers[resourceTypeNumber] ?? 0;
}

function computeContributionPoints(totalPoints: number, qty: number, type: BigInt) {
  const effectiveContribution = qty * getResourceMultiplier(type);
  const points = (effectiveContribution / TOTAL_EFFECTIVE_CONTRIBUTION) * totalPoints;
  return points;
}

export interface PlayerPointsLeaderboardInterface {
  address: string;
  addressName: string;
  order: string;
  totalPoints: number;
  isYours: boolean;
}

interface LeaderboardStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  playerPointsLeaderboard: PlayerPointsLeaderboardInterface[];
  setPointsLeaderboards: (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    loading: false,
    playerPointsLeaderboard: [],
    setPointsLeaderboards: (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]) =>
      set({ playerPointsLeaderboard: playerPointsLeaderboard }),
    setLoading: (loading) => set({ loading }),
  };
});

export const useComputePointsLeaderboards = () => {
  const setPointsLeaderboards = useLeaderBoardStore((state) => state.setPointsLeaderboards);
  const [computed, setComputed] = useState(false);
  const { getContributions } = useContributions();
  const { getAddressName, getAddressOrder } = useRealm();
  const account = useDojo().account.account;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const updatePointsLeaderboard = useCallback(
    (
      hyperstructureEntityId: bigint,
      finishedTimestamp: number,
      currentTimestamp: number,
    ): PlayerPointsLeaderboardInterface[] => {
      const contributions = getContributions(hyperstructureEntityId);

      const nbOfCycles = Math.floor(
        (currentTimestamp - finishedTimestamp) / EternumGlobalConfig.tick.tickIntervalInSeconds,
      );
      let totalHyperstructurePoints = PTS_PER_CYCLE * nbOfCycles;

      let tempPlayerPointsLeaderboard: PlayerPointsLeaderboardInterface[] = [];

      contributions.forEach((contribution) => {
        const playerAddress: string = "0x" + contribution.player_address.toString(16);
        const index = tempPlayerPointsLeaderboard.findIndex((player) => player.address === playerAddress);

        if (index >= 0) {
          tempPlayerPointsLeaderboard[index].totalPoints += computeContributionPoints(
            totalHyperstructurePoints,
            Number(contribution.amount),
            BigInt(contribution.resource_type),
          );
        } else {
          tempPlayerPointsLeaderboard.push({
            address: playerAddress,
            addressName: getAddressName(playerAddress) || displayAddress(playerAddress),
            order: getOrderName(getAddressOrder(playerAddress) || 1),
            totalPoints: computeContributionPoints(
              totalHyperstructurePoints,
              Number(contribution.amount),
              BigInt(contribution.resource_type),
            ),
            isYours: playerAddress === account.address,
          });
        }
      });
      return tempPlayerPointsLeaderboard;
    },
    [getContributions],
  );

  useEffect(() => {
    if (!nextBlockTimestamp || computed) return;

    getHyperstructureEvents().then((events) => {
      let _tmpPlayerPointsLeaderboard;
      events.forEach((event) => {
        const { hyperstructureEntityId, timestamp } = event;
        _tmpPlayerPointsLeaderboard = updatePointsLeaderboard(hyperstructureEntityId, timestamp, nextBlockTimestamp);
      });
      _tmpPlayerPointsLeaderboard && setPointsLeaderboards(_tmpPlayerPointsLeaderboard);
      setComputed(true);
    });
  }, [nextBlockTimestamp]);
};

export default useLeaderBoardStore;
