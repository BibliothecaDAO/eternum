import type { ResourceArrivalInfo } from "@bibliothecadao/types";
import { RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";

/** The Transfer badge and attention navigation share the runner's unclaimed arrivals. */
export function resolveResourceArrivalIndicators(arrivals: ResourceArrivalInfo[], now: number) {
  const arrived = arrivals.filter(
    (arrival) => now >= Number(arrival.arrivesAt) + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS,
  );
  return {
    arrivedArrivalsNumber: arrived.length,
    pendingArrivalsNumber: arrivals.length - arrived.length,
    arrivedArrivalStructureIds: [...new Set(arrived.map((arrival) => arrival.structureEntityId))],
  };
}
