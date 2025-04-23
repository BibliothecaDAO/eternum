import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import { SystemCalls, ClientComponents, ResourceArrivalInfo } from "@bibliothecadao/types";

export class ResourceArrivalManager {
  arrival: ResourceArrivalInfo;

  constructor(
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    arrival: ResourceArrivalInfo,
  ) {
    this.arrival = arrival;
  }

  public optimisticOffload() {
    const overrideId = uuid();

    const entity = getEntityIdFromKeys([BigInt(this.arrival.structureEntityId), BigInt(this.arrival.day)]);

    const currentArrival = getComponentValue(this.components.ResourceArrival, entity);

    if (!currentArrival) {
      console.error("Could not find current arrival for optimistic update");
      throw new Error("Could not find current arrival for optimistic update");
    }

    const totalOffloadedAmount = this.arrival.resources.reduce((sum, resource) => sum + resource.amount, 0);

    this.components.ResourceArrival.addOverride(overrideId, {
      entity,
      value: {
        structure_id: this.arrival.structureEntityId,
        day: this.arrival.day,
        slot_1: currentArrival.slot_1,
        slot_2: currentArrival.slot_2,
        slot_3: currentArrival.slot_3,
        slot_4: currentArrival.slot_4,
        slot_5: currentArrival.slot_5,
        slot_6: currentArrival.slot_6,
        slot_7: currentArrival.slot_7,
        slot_8: currentArrival.slot_8,
        slot_9: currentArrival.slot_9,
        slot_10: currentArrival.slot_10,
        slot_11: currentArrival.slot_11,
        slot_12: currentArrival.slot_12,
        slot_13: currentArrival.slot_13,
        slot_14: currentArrival.slot_14,
        slot_15: currentArrival.slot_15,
        slot_16: currentArrival.slot_16,
        slot_17: currentArrival.slot_17,
        slot_18: currentArrival.slot_18,
        slot_19: currentArrival.slot_19,
        slot_20: currentArrival.slot_20,
        slot_21: currentArrival.slot_21,
        slot_22: currentArrival.slot_22,
        slot_23: currentArrival.slot_23,
        slot_24: currentArrival.slot_24,
        // Set the specific slot being offloaded to an empty array
        [`slot_${this.arrival.slot}`]: [],
        initialized: currentArrival.initialized,
        total_amount: currentArrival.total_amount - BigInt(totalOffloadedAmount),
      },
    });

    return overrideId;
  }

  public async offload(signer: Account | AccountInterface, resourceCount: number) {
    return this.systemCalls.arrivals_offload({
      signer,
      structureId: this.arrival.structureEntityId,
      day: this.arrival.day,
      slot: this.arrival.slot,
      resource_count: resourceCount,
    });
  }
}
