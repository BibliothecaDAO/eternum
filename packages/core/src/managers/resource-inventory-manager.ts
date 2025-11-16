import { ResourceManager } from "..";
import { ClientComponents, SystemCalls, type DojoAccount, type ID, type Resource } from "@bibliothecadao/types";
export class ResourceInventoryManager {
  carrierEntityId: ID;

  constructor(
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    carrierEntityId: ID,
  ) {
    this.carrierEntityId = carrierEntityId;
  }

  private readonly _optimisticOffloadAll = (receiverEntityId: ID, inventoryResources: Resource[]) => {
    const removeResourceOverrides: Array<() => void> = [];
    inventoryResources.forEach((resource) => {
      const resourceManager = new ResourceManager(this.components, receiverEntityId);
      const removeOverride = resourceManager.optimisticResourceUpdate(resource.resourceId, resource.amount);
      removeResourceOverrides.push(removeOverride);
    });

    return () => {
      removeResourceOverrides.forEach((removeOverride) => removeOverride());
    };
  };

  public onOffloadAll = async (signer: DojoAccount, receiverEntityId: ID, inventoryResources: Resource[]) => {
    const removeResourceOverride = this._optimisticOffloadAll(receiverEntityId, inventoryResources);

    if (inventoryResources.length > 0) {
      await this.systemCalls
        .send_resources({
          signer,
          sender_entity_id: this.carrierEntityId,
          recipient_entity_id: receiverEntityId,
          resources: inventoryResources.map((resource) => ({ resource: resource.resourceId, amount: resource.amount })),
        })
        .finally(() => {
          removeResourceOverride();
        });
    }
  };
}
