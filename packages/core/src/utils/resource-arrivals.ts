import { ClientComponents, ID, Resource, ResourceArrivalInfo, ResourcesIds } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue, HasValue, runQuery } from "@dojoengine/recs";

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
  const arrivalsInfo: ResourceArrivalInfo[] = [];

  arrivals.forEach((arrival) => {
    const structureEntityId = arrival.structure_id;
    const day = arrival.day;

    for (let slotNumber = 1; slotNumber <= 24; slotNumber++) {
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

            if (amount > 0) {
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

      // Calculate arrivesAt based on day and slot
      // Based on the Cairo implementation:
      // - day is days since Unix epoch (day = timestamp / 86400)
      // - slot is 1-indexed hour of the day (1-24), where:
      //   - slot 1 = 00:00:00 to 00:59:59
      //   - slot 2 = 01:00:00 to 01:59:59
      //   - ...
      //   - slot 24 = 23:00:00 to 23:59:59

      // Convert day to seconds (86400 seconds per day)
      const dayInSeconds = BigInt(day) * 86400n;

      // Calculate the hour timestamp for this slot
      // Slot 1 = hour 0 (00:00:00), Slot 2 = hour 1 (01:00:00), etc.
      const hourInSeconds = BigInt(slotNumber) * 3600n;

      // Calculate the timestamp (exact hour boundary)
      const arrivesAt = dayInSeconds + hourInSeconds;

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
