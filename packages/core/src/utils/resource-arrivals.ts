import {
  ClientComponents,
  ID,
  Resource,
  ResourceArrivalInfo,
  ResourcesIds,
  TickIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { ComponentValue, getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { configManager } from "../managers";
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

export const getAllArrivals = (structureEntityIds: ID[], components: ClientComponents) => {
  const arrivals: ComponentValue<ClientComponents["ResourceArrival"]["schema"]>[] = [];

  for (const structureEntityId of structureEntityIds) {
    const arrivalEntities = runQuery([HasValue(components.ResourceArrival, { structure_id: structureEntityId })]);
    arrivalEntities.forEach((arrivalsEntityId) => {
      const arrival = getComponentValue(components.ResourceArrival, arrivalsEntityId);
      if (arrival) {
        arrivals.push(arrival);
      }
    });
  }

  return formatArrivals(arrivals);
};

export const formatArrivals = (arrivals: ComponentValue<ClientComponents["ResourceArrival"]["schema"]>[]) => {
  const deliveryTickSeconds = configManager.getTick(TickIds.Delivery);
  const arrivalsInfo: ResourceArrivalInfo[] = [];
  const lastSlotNumber = 48;

  arrivals.forEach((arrival) => {
    const structureEntityId = arrival.structure_id;
    const day = arrival.day;

    for (let slotNumber = 1; slotNumber <= lastSlotNumber; slotNumber++) {
      const slotKey = `slot_${slotNumber}` as keyof typeof arrival;

      const rawSlotResources = arrival[slotKey];
      if (!rawSlotResources || (Array.isArray(rawSlotResources) && rawSlotResources.length === 0)) {
        continue;
      }

      const resources: Resource[] = [];
      if (Array.isArray(rawSlotResources)) {
        for (const item of rawSlotResources) {
          if (Array.isArray(item) && item.length >= 2) {
            const resourceIdObj = item[0];
            const resourceId =
              resourceIdObj && typeof resourceIdObj === "object" && "value" in resourceIdObj
                ? Number(resourceIdObj.value)
                : 0;

            const amountObj = item[1];
            let amount = 0;

            if (amountObj && typeof amountObj === "object" && "value" in amountObj) {
              const amountValue = amountObj.value;
              if (typeof amountValue === "string" && amountValue.startsWith("0x")) {
                amount = Number(BigInt(amountValue));
              } else {
                amount = Number(amountValue);
              }
            }

            if (amount >= 0) {
              resources.push({
                resourceId: resourceId as ResourcesIds,
                amount,
              });
            }
          }
        }
      }

      if (resources.length === 0) {
        continue;
      }

      const dayInSeconds = BigInt(day) * BigInt(deliveryTickSeconds) * BigInt(lastSlotNumber);
      const slotInSeconds = BigInt(slotNumber) * BigInt(deliveryTickSeconds);
      const arrivesAt = dayInSeconds + slotInSeconds;

      arrivalsInfo.push({
        structureEntityId,
        resources,
        arrivesAt,
        day,
        slot: BigInt(slotNumber),
      });
    }
  });

  return arrivalsInfo;
};
