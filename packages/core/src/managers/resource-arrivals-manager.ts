import { ClientComponents, ResourceArrivalInfo, SystemCalls } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";

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
        slot_25: currentArrival.slot_25,
        slot_26: currentArrival.slot_26,
        slot_27: currentArrival.slot_27,
        slot_28: currentArrival.slot_28,
        slot_29: currentArrival.slot_29,
        slot_30: currentArrival.slot_30,
        slot_31: currentArrival.slot_31,
        slot_32: currentArrival.slot_32,
        slot_33: currentArrival.slot_33,
        slot_34: currentArrival.slot_34,
        slot_35: currentArrival.slot_35,
        slot_36: currentArrival.slot_36,
        slot_37: currentArrival.slot_37,
        slot_38: currentArrival.slot_38,
        slot_39: currentArrival.slot_39,
        slot_40: currentArrival.slot_40,
        slot_41: currentArrival.slot_41,
        slot_42: currentArrival.slot_42,
        slot_43: currentArrival.slot_43,
        slot_44: currentArrival.slot_44,
        slot_45: currentArrival.slot_45,
        slot_46: currentArrival.slot_46,
        slot_47: currentArrival.slot_47,
        slot_48: currentArrival.slot_48,
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
