import { getOrderName, HYPERSTRUCTURE_TOTAL_COSTS_SCALED, orders } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { useGetRealms, useRealm } from "../helpers/useRealm";
import { useEffect, useRef, useState } from "react";
import { useEntities } from "../helpers/useEntities";

import { Subscription } from "rxjs";
import useBlockchainStore from "../store/useBlockchainStore";
import { useContributions } from "../helpers/useContributions";
import { ResourcesIds } from "@bibliothecadao/eternum";

// Define elsewhere
const PTS_PER_CYCLE = 100;
const CYCLE_TIME = 24 * 60 * 60 * 1000;

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

// export interface OrderResourceLeaderboardInterface {
//   order: string;
//   realmCount: number;
//   totalResources: number;
//   isYours: boolean;
// }

interface LeaderboardStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  playerPointsLeaderboard: PlayerPointsLeaderboardInterface[];
  // orderResourceLeaderboard: OrderResourceLeaderboardInterface[];
  setPointsLeaderboards: (
    playerPointsLeaderboard: PlayerPointsLeaderboardInterface[],
    // orderResourceLeaderboard: OrderResourceLeaderboardInterface[],
  ) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    loading: false,
    playerPointsLeaderboard: [],
    // orderResourceLeaderboard: [],
    setPointsLeaderboards: (
      playerPointsLeaderboard: PlayerPointsLeaderboardInterface[],
      // orderResourceLeaderboard: OrderResourceLeaderboardInterface[],
    ) => set({ playerPointsLeaderboard: playerPointsLeaderboard }),
    setLoading: (loading) => set({ loading }),
  };
});

export const useComputePointsLeaderboards = () => {
  const {
    account: { account },
    setup: {
      components: { Resource, Realm, Contribution },
      updates: {
        eventUpdates: { createHyperstructureFinishedEvents: hyperstructureFinishedEvents },
      },
    },
  } = useDojo();

  const { setPointsLeaderboards, playerPointsLeaderboard } = useLeaderBoardStore();
  const { playerRealms } = useEntities();

  const { getAddressName } = useRealm();

  // todo: do entities like bank accounts as well
  const realms = useGetRealms();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const subscriptionRef = useRef<Subscription | undefined>();
  const isComponentMounted = useRef(true);

  // Subscribe outside of leaderboard ?
  useEffect(() => {
    const subscribeToHyperstructureFinished = async () => {
      const observable = await hyperstructureFinishedEvents();
      const subscription = observable.subscribe((event) => {
        // Handles undefined nextBlockTimestamp
        if (event && nextBlockTimestamp) {
          const updatedPointsLeaderboard = updatePointsLeaderboard(event);
          setPointsLeaderboards(updatedPointsLeaderboard);
        }
        subscriptionRef.current = subscription;
      });
      subscribeToHyperstructureFinished();

      return () => {
        isComponentMounted.current = false;
        subscriptionRef.current?.unsubscribe();
      };
    };
  }, []);

  const updatePointsLeaderboard = (event: any): PlayerPointsLeaderboardInterface[] => {
    const hyperstructureEntityId = BigInt(event.keys[0]);
    const creationTimestamp = BigInt(event.keys[1]);

    const nbOfCycles = Math.floor(Number(BigInt(nextBlockTimestamp!) - creationTimestamp) / CYCLE_TIME);
    let totalHyperstructurePoints = PTS_PER_CYCLE * nbOfCycles;

    // Rename temp var
    let tempPlayerPointsLeaderboard = playerPointsLeaderboard;

    const { contributionsToHyperstructure } = useContributions(hyperstructureEntityId);

    contributionsToHyperstructure().forEach((contribution) => {
      // Probably add 0x and convert to string, needs to be tested
      const playerAddress = "0x" + String(contribution.player_address);

      const index = tempPlayerPointsLeaderboard.findIndex((player) => player.address === playerAddress);
      tempPlayerPointsLeaderboard[index].totalPoints += computeContributionPoints(
        totalHyperstructurePoints,
        contribution.amount,
        BigInt(contribution.resource_type),
      );
    });

    return tempPlayerPointsLeaderboard;
  };

  // useEffect(() => {
  //   const playerOrder = getOrderName(
  //     getComponentValue(Realm, getEntityIdFromKeys([playerRealms()[0]?.entity_id || 0n]))?.order || 0,
  //   );

  //   const playerResourceLeaderboard: PlayerResourceLeaderboardInterface[] = [];
  //   const orderResourceLeaderboard: Record<string, OrderResourceLeaderboardInterface> = {};
  //   orders
  //     .filter((order) => order.orderId !== 17)
  //     .forEach((order) => {
  //       const isYours = order.orderName.toLowerCase() === playerOrder;
  //       orderResourceLeaderboard[order.orderName] = {
  //         order: order.orderName,
  //         realmCount: 0,
  //         totalResources: 0,
  //         isYours,
  //       };
  //     });

  //   for (const realm of realms) {
  //     const owner = "0x" + realm.owner?.toString(16) || "0x0";
  //     const resourceAmounts = getComponentValue(Resource, getEntityIdFromKeys([realm.entity_id, resourceId]));
  //     if (resourceAmounts && resourceAmounts?.balance > 100000000) continue;
  //     let order = getOrderName(realm.order);
  //     const isYours = account.address === owner;
  //     const existingEntryIndex = playerResourceLeaderboard.findIndex((entry) => entry.address === owner);
  //     if (existingEntryIndex !== -1) {
  //       playerResourceLeaderboard[existingEntryIndex].totalResources += Number(resourceAmounts?.balance) || 0;
  //     } else {
  //       playerResourceLeaderboard.push({
  //         address: owner,
  //         addressName: getAddressName(owner) || "",
  //         order,
  //         totalResources: Number(resourceAmounts?.balance) || 0,
  //         isYours,
  //       });
  //     }

  //     if (!orderResourceLeaderboard[order]) {
  //       orderResourceLeaderboard[order] = {
  //         order,
  //         realmCount: 1,
  //         totalResources: Number(resourceAmounts?.balance) || 0,
  //         isYours: order === playerOrder,
  //       };
  //     } else {
  //       orderResourceLeaderboard[order].realmCount++;
  //       orderResourceLeaderboard[order].totalResources += Number(resourceAmounts?.balance) || 0;
  //     }
  //   }

  //   setResourceLeaderboards(
  //     playerResourceLeaderboard.sort((a, b) => b.totalResources - a.totalResources),
  //     Object.values(orderResourceLeaderboard).sort((a, b) => b.totalResources - a.totalResources),
  //   );
  // }, [resourceId]);
};

export default useLeaderBoardStore;
