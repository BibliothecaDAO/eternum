import { ClientComponents, ID, Resource, ResourceArrivalInfo, ResourcesIds, TickIds } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { configManager } from "../managers";

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

      let dayInSeconds = BigInt(day) * BigInt(deliveryTickSeconds) * BigInt(lastSlotNumber);
      let slotInSeconds = BigInt(slotNumber) * BigInt(deliveryTickSeconds);
      let arrivesAt = dayInSeconds + slotInSeconds;

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
