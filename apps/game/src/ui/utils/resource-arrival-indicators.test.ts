// @vitest-environment node
import { expect, it } from "vitest";
import type { ResourceArrivalInfo } from "@bibliothecadao/types";
import { RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";
import { resolveResourceArrivalIndicators } from "./resource-arrival-indicators";
it("uses the badge readiness boundary and counts arrivals separately from destinations", () => {
  const arrivals: ResourceArrivalInfo[] = [
    { structureEntityId: 1, arrivesAt: 100 },
    { structureEntityId: 1, arrivesAt: 99 },
    { structureEntityId: 2, arrivesAt: 101 },
  ].map((arrival, slot) => ({
    ...arrival,
    resources: [],
    day: 0n,
    arrivesAt: BigInt(arrival.arrivesAt),
    slot: BigInt(slot),
  }));
  expect(resolveResourceArrivalIndicators(arrivals, 100 + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS)).toEqual({
    arrivedArrivalsNumber: 2,
    pendingArrivalsNumber: 1,
    arrivedArrivalStructureIds: [1],
  });
});
it("clears both counters and destination IDs after claim", () => {
  expect(resolveResourceArrivalIndicators([], 100)).toEqual({
    arrivedArrivalsNumber: 0,
    pendingArrivalsNumber: 0,
    arrivedArrivalStructureIds: [],
  });
});
