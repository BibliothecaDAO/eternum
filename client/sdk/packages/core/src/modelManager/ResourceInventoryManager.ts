import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "../dojo/createClientComponents";
import { EternumProvider } from "../provider";
import { type ID, type Resource } from "../types";
import { DojoAccount } from "./types";

export class ResourceInventoryManager {
  carrierEntityId: ID;

  constructor(
    private readonly components: ClientComponents,
    private readonly provider: EternumProvider,
    carrierEntityId: ID,
  ) {
    this.carrierEntityId = carrierEntityId;
  }

  private readonly _optimisticOffloadAll = (
    overrideId: string,
    receiverEntityId: ID,
    inventoryResources: Resource[],
  ) => {
    inventoryResources.forEach((resource) => {
      const receiveResourceEntity = getEntityIdFromKeys([BigInt(receiverEntityId), BigInt(resource.resourceId)]);
      const receiverBalance = getComponentValue(this.components.Resource, receiveResourceEntity)?.balance || 0n;

      // optimistically update the balance of the receiver
      this.components.Resource.addOverride(overrideId, {
        entity: receiveResourceEntity,
        value: {
          entity_id: receiverEntityId,
          resource_type: resource.resourceId,
          balance: receiverBalance + BigInt(resource.amount),
        },
      });
    });

    const carrierEntity = getEntityIdFromKeys([BigInt(this.carrierEntityId)]);

    this.components.Weight.addOverride(overrideId, {
      entity: carrierEntity,
      value: {
        entity_id: this.carrierEntityId,
        value: 0n,
      },
    });

    // need to update this for the arrivals list to get updated
    this.components.OwnedResourcesTracker.addOverride(overrideId, {
      entity: carrierEntity,
      value: {
        entity_id: this.carrierEntityId,
        resource_types: 0n,
      },
    });
  };

  public onOffloadAll = async (signer: DojoAccount, receiverEntityId: ID, inventoryResources: Resource[]) => {
    const overrideId = uuid();
    this._optimisticOffloadAll(overrideId, receiverEntityId, inventoryResources);

    if (inventoryResources.length > 0) {
      await this.provider
        .send_resources({
          signer,
          sender_entity_id: this.carrierEntityId,
          recipient_entity_id: receiverEntityId,
          resources: inventoryResources.flatMap((resource) => [resource.resourceId, resource.amount]),
        })
        .finally(() => {
          this.components.Resource.removeOverride(overrideId);
          this.components.Weight.removeOverride(overrideId);
          this.components.OwnedResourcesTracker.removeOverride(overrideId);
        });
    }
  };
}
