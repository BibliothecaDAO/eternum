import { useDojo } from "../../DojoContext";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";

export function useProduction() {
  const {
    setup: {
      components: { Production, Resource },
    },
  } = useDojo();

  const getBalance = (resourceId: bigint, entityId: bigint) => {
    const productionManager = new ProductionManager(Production, Resource, entityId, resourceId);
    return productionManager.balance();
  };

  return { getBalance };
}
