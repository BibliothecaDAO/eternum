import { ID, ResourceArrivalInfo, ResourcesIds, TickIds, TroopTier, TroopType } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager } from "../managers/config-manager";
import { isMilitaryResource } from "./resources";
import { divideByPrecision } from "./utils";

export interface IncomingTroopArrival {
  structureEntityId: ID;
  resourceId: ResourcesIds;
  troopType: TroopType;
  troopTier: TroopTier;
  count: number;
  arrivesAt: bigint;
  day: number;
  slot: bigint;
}

const TROOP_TIER_PRIORITY: Record<TroopTier, number> = {
  [TroopTier.T1]: 1,
  [TroopTier.T2]: 2,
  [TroopTier.T3]: 3,
};

export const resolveTroopDescriptorFromResourceId = (
  resourceId: ResourcesIds,
): { troopType: TroopType; troopTier: TroopTier } | null => {
  switch (resourceId) {
    case ResourcesIds.Knight:
      return { troopType: TroopType.Knight, troopTier: TroopTier.T1 };
    case ResourcesIds.KnightT2:
      return { troopType: TroopType.Knight, troopTier: TroopTier.T2 };
    case ResourcesIds.KnightT3:
      return { troopType: TroopType.Knight, troopTier: TroopTier.T3 };
    case ResourcesIds.Paladin:
      return { troopType: TroopType.Paladin, troopTier: TroopTier.T1 };
    case ResourcesIds.PaladinT2:
      return { troopType: TroopType.Paladin, troopTier: TroopTier.T2 };
    case ResourcesIds.PaladinT3:
      return { troopType: TroopType.Paladin, troopTier: TroopTier.T3 };
    case ResourcesIds.Crossbowman:
      return { troopType: TroopType.Crossbowman, troopTier: TroopTier.T1 };
    case ResourcesIds.CrossbowmanT2:
      return { troopType: TroopType.Crossbowman, troopTier: TroopTier.T2 };
    case ResourcesIds.CrossbowmanT3:
      return { troopType: TroopType.Crossbowman, troopTier: TroopTier.T3 };
    default:
      return null;
  }
};

export const summarizeIncomingTroopArrivals = (
  arrivals: ResourceArrivalInfo[],
  nowSeconds: number,
): Record<string, IncomingTroopArrival[]> => {
  const arrivalsByStructure: Record<string, IncomingTroopArrival[]> = {};

  arrivals.forEach((arrival) => {
    if (Number(arrival.arrivesAt) <= nowSeconds) {
      return;
    }

    const structureKey = String(arrival.structureEntityId);

    arrival.resources.forEach((resource) => {
      if (!isMilitaryResource(resource.resourceId)) {
        return;
      }

      const troopDescriptor = resolveTroopDescriptorFromResourceId(resource.resourceId);
      if (!troopDescriptor) {
        return;
      }

      const count = divideByPrecision(resource.amount);
      if (count <= 0) {
        return;
      }

      arrivalsByStructure[structureKey] ??= [];
      arrivalsByStructure[structureKey].push({
        structureEntityId: arrival.structureEntityId,
        resourceId: resource.resourceId,
        troopType: troopDescriptor.troopType,
        troopTier: troopDescriptor.troopTier,
        count,
        arrivesAt: arrival.arrivesAt,
        day: Number(arrival.day),
        slot: arrival.slot,
      });
    });
  });

  Object.values(arrivalsByStructure).forEach((structureArrivals) => {
    structureArrivals.sort((left, right) => {
      const arrivalDelta = Number(left.arrivesAt - right.arrivesAt);
      if (arrivalDelta !== 0) {
        return arrivalDelta;
      }

      const tierDelta = TROOP_TIER_PRIORITY[left.troopTier] - TROOP_TIER_PRIORITY[right.troopTier];
      if (tierDelta !== 0) {
        return tierDelta;
      }

      return left.troopType.localeCompare(right.troopType);
    });
  });

  return arrivalsByStructure;
};

export const formatArrivals = (arrivals: Iterable<NativeRows["ResourceArrival"]>): ResourceArrivalInfo[] => {
  const deliveryTickSeconds = BigInt(configManager.getTick(TickIds.Delivery));
  return [...arrivals]
    .filter((arrival) => arrival.resources.length > 0)
    .map((arrival) => ({
      structureEntityId: arrival.entity_id,
      resources: arrival.resources.map(({ resource_type, amount }) => ({
        resourceId: resource_type as ResourcesIds,
        amount: Number(amount),
      })),
      arrivesAt: (arrival.day * 48n + BigInt(arrival.slot)) * deliveryTickSeconds,
      day: arrival.day,
      slot: BigInt(arrival.slot),
    }));
};
