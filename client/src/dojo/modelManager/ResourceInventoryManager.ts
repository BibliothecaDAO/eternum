import { useAccountStore } from "@/hooks/context/accountStore";
import { Resource, type ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { type SetupResult } from "../setup";

export class ResourceInventoryManager {
  entityId: ID;

  constructor(
    private readonly setup: SetupResult,
    entityId: ID,
  ) {
    this.entityId = entityId;
  }

  private readonly _optimisticOffloadAll = (
    overrideId: string,
    receiverEntityId: ID,
    inventoryResources: Resource[],
  ) => {
    inventoryResources.forEach((resource) => {
      const entity = getEntityIdFromKeys([BigInt(receiverEntityId), BigInt(resource.resourceId)]);
      const receiverBalance = getComponentValue(this.setup.components.Resource, entity)?.balance || 0n;

      // optimistically update the balance of the receiver
      this.setup.components.Resource.addOverride(overrideId, {
        entity,
        value: {
          resource_type: resource.resourceId,
          balance: receiverBalance + BigInt(resource.amount),
        },
      });
    });

    const entity = getEntityIdFromKeys([BigInt(this.entityId)]);

    this.setup.components.Weight.addOverride(overrideId, {
      entity,
      value: {
        value: 0n,
      },
    });
  };

  public onOffloadAll = async (receiverEntityId: ID, inventoryResources: Resource[]) => {
    const overrideId = uuid();
    this._optimisticOffloadAll(overrideId, receiverEntityId, inventoryResources);

    if (inventoryResources.length > 0) {
      await this.setup.systemCalls
        .send_resources({
          sender_entity_id: this.entityId,
          recipient_entity_id: receiverEntityId,
          resources: inventoryResources.flatMap((resource) => [resource.resourceId, resource.amount]),
          signer: useAccountStore.getState().account!,
        })
        .finally(() => {
          this.setup.components.Resource.removeOverride(overrideId);
          this.setup.components.Weight.removeOverride(overrideId);
        });
    }
  };

  public onOffloadAllMultiple = async (
    transfers: {
      senderEntityId: ID;
      recipientEntityId: ID;
      resources: Resource[];
    }[],
  ) => {
    const overrideId = uuid();

    // Apply optimistic updates for each transfer
    transfers.forEach((transfer) => {
      transfer.resources.forEach((resource) => {
        const recipientEntity = getEntityIdFromKeys([BigInt(transfer.recipientEntityId), BigInt(resource.resourceId)]);
        const recipientBalance = getComponentValue(this.setup.components.Resource, recipientEntity)?.balance || 0n;

        this.setup.components.Resource.addOverride(overrideId, {
          entity: recipientEntity,
          value: {
            resource_type: resource.resourceId,
            balance: recipientBalance + BigInt(resource.amount),
          },
        });
      });

      // Reset weight for sender
      const senderEntity = getEntityIdFromKeys([BigInt(transfer.senderEntityId)]);
      this.setup.components.Weight.addOverride(overrideId, {
        entity: senderEntity,
        value: {
          value: 0n,
        },
      });
    });

    try {
      await this.setup.systemCalls.send_resources_multiple({
        calls: transfers.map((transfer) => ({
          sender_entity_id: transfer.senderEntityId,
          recipient_entity_id: transfer.recipientEntityId,
          resources: transformResources(transfer.resources),
        })),
        signer: useAccountStore.getState().account!,
      });
    } finally {
      // Clean up overrides
      this.setup.components.Resource.removeOverride(overrideId);
      this.setup.components.Weight.removeOverride(overrideId);
    }
  };
}

const transformResources = (resources: Resource[]) => {
  return resources.flatMap((resource) => [resource.resourceId, resource.amount]);
};
