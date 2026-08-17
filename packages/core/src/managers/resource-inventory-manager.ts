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

  public onOffloadAll = async (signer: DojoAccount, receiverEntityId: ID, inventoryResources: Resource[]) => {
    if (inventoryResources.length === 0) return;

    await new ResourceManager(this.components, receiverEntityId).submitProvisionalResourceTransaction(
      inventoryResources.map((resource) => ({ resourceId: resource.resourceId, amount: resource.amount })),
      signer,
      () =>
        this.systemCalls.send_resources({
          signer,
          sender_entity_id: this.carrierEntityId,
          recipient_entity_id: receiverEntityId,
          resources: inventoryResources.map((resource) => ({ resource: resource.resourceId, amount: resource.amount })),
        }),
    );
  };
}
