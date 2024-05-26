import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  getOrderName,
} from "@bibliothecadao/eternum";
import { create } from "zustand";
import { HyperstructureEventInterface } from "@/dojo/events/hyperstructureEventQueries";
import useBlockchainStore from "../store/useBlockchainStore";
import { useContributions } from "../helpers/useContributions";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { getHyperstructureEvents } from "@/dojo/events/hyperstructureEventQueries";
import { useCallback, useEffect } from "react";
import { useRealm } from "../helpers/useRealm";
import { displayAddress } from "@/ui/utils/utils";
import { useDojo } from "../context/DojoContext";

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
  const effectiveContribution = qty * getResourceMultiplier(resourceType);
  const points = (effectiveContribution / TOTAL_CONTRIBUTABLE_AMOUNT) * totalPoints;
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
  finishedHyperstructures: HyperstructureEventInterface[];
  setFinishedHyperstructures: (val: HyperstructureEventInterface[]) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    loading: false,
    playerPointsLeaderboard: [],
    setPointsLeaderboards: (playerPointsLeaderboard: PlayerPointsLeaderboardInterface[]) =>
      set({ playerPointsLeaderboard: playerPointsLeaderboard }),
    setLoading: (loading) => set({ loading }),
    finishedHyperstructures: [],
    setFinishedHyperstructures: (val: HyperstructureEventInterface[]) => set({ finishedHyperstructures: val }),
  };
});

export const useComputePointsLeaderboards = () => {
  const setPointsLeaderboards = useLeaderBoardStore((state) => state.setPointsLeaderboards);
  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);
  const { getContributions } = useContributions();
  const { getAddressName, getAddressOrder } = useRealm();
  const {
    account: { account },
  } = useDojo();

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
      let totalHyperstructurePoints = HYPERSTRUCTURE_POINTS_PER_CYCLE * nbOfCycles;

      let tempPlayerPointsLeaderboard: PlayerPointsLeaderboardInterface[] = [];

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
          });
        }
      });
      return tempPlayerPointsLeaderboard;
    },
    [getContributions],
  );

  useEffect(() => {
    if (!nextBlockTimestamp) return;

    getHyperstructureEvents().then((events) => {
      let _tmpPlayerPointsLeaderboard;
      events.forEach((event) => {
        const { hyperstructureEntityId, timestamp } = event;
        _tmpPlayerPointsLeaderboard = updatePointsLeaderboard(hyperstructureEntityId, timestamp, nextBlockTimestamp);
      });
      _tmpPlayerPointsLeaderboard && setPointsLeaderboards(_tmpPlayerPointsLeaderboard);
      setFinishedHyperstructures(events);
    });
  }, [finishedHyperstructures.length]);
};

export default useLeaderBoardStore;
