import { uuid } from "@latticexyz/utils";
import { ResourceManager, type DojoAccount, type ID, type Resource } from "..";
import { ClientComponents } from "../dojo/create-client-components";
import { EternumProvider } from "../provider";

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
      const resourceManager = new ResourceManager(this.components, receiverEntityId);
      resourceManager.optimisticResourceUpdate(overrideId, resource.resourceId, -BigInt(resource.amount));
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
          resources: inventoryResources.map((resource) => ({ resource: resource.resourceId, amount: resource.amount })),
        })
        .finally(() => {
          this.components.Resource.removeOverride(overrideId);
        });
    }
  };
}
