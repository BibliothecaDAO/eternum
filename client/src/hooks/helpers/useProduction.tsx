import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export function useProduction() {
  const {
    setup: {
      components: { Production, Resource },
    },
  } = useDojo();

  const getBalance = (resourceId: bigint, entityId: bigint) => {
    const productionManager = new ProductionManager(Production, entityId, resourceId);
    const resource = getComponentValue(Resource, getEntityIdFromKeys([entityId, resourceId]));
    return productionManager.balance() + (Number(resource?.balance) || 0);
  };

  return { getBalance };
}
