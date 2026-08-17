import { ClientComponents, ResourceArrivalInfo, SystemCalls } from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";

export class ResourceArrivalManager {
  arrival: ResourceArrivalInfo;

  constructor(
    _components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    arrival: ResourceArrivalInfo,
  ) {
    this.arrival = arrival;
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
