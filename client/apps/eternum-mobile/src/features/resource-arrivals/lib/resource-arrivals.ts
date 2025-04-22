import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { ResourceArrivalManager } from "@bibliothecadao/eternum";
import { ResourceArrivalInfo } from "@bibliothecadao/types";
import { useArrivalsByStructure, useDojo } from "@bibliothecadao/react";
import { ResourceArrivalSummary } from "../model/types";

export const useResourceArrivals = (structureId: number) => {
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const arrivals = useArrivalsByStructure(structureId);
  const { currentBlockTimestamp } = getBlockTimestamp();

  const calculateSummary = (arrivals: ResourceArrivalInfo[]): ResourceArrivalSummary => {
    if (!currentBlockTimestamp) {
      return { readyArrivals: 0, pendingArrivals: 0, totalResources: 0 };
    }

    const readyArrivals = arrivals.filter((arrival) => arrival.arrivesAt <= currentBlockTimestamp).length;

    return {
      readyArrivals,
      pendingArrivals: arrivals.length - readyArrivals,
      totalResources: arrivals.reduce((total, arrival) => total + arrival.resources.filter(Boolean).length, 0),
    };
  };

  const claimResources = async (arrival: ResourceArrivalInfo) => {
    const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);

    if (arrival.resources.length > 0) {
      await resourceArrivalManager.offload(account, arrival.resources.length);
    }
  };

  const summary = calculateSummary(arrivals);

  return {
    arrivals,
    summary,
    claimResources,
    isReady: (arrival: ResourceArrivalInfo) =>
      currentBlockTimestamp ? arrival.arrivesAt <= currentBlockTimestamp : false,
  };
};
