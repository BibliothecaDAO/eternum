import useUIStore from "@/hooks/store/use-ui-store";
import { ClientComponents, configManager, ID, Resource, ResourceManager, resources } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const getResourcesFromBalance = (entityId: ID, components: ClientComponents): Resource[] => {
  const currentDefaultTick = useUIStore.getState().currentDefaultTick;

  const weight = getComponentValue(components.Weight, getEntityIdFromKeys([BigInt(entityId)]));
  const hasWeightlessResources = configManager
    .getWeightLessResources()
    .some(
      (resourceId) =>
        (getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]))?.balance ??
          0n) > 0n,
    );
  if (!weight?.value && !hasWeightlessResources) return [];
  const resourceIds = resources.map((r) => r.id);
  return resourceIds
    .map((id) => {
      const resourceManager = new ResourceManager(components, entityId, id);
      const balance = resourceManager.balance(currentDefaultTick);
      return { resourceId: id, amount: balance };
    })
    .filter((r) => r.amount > 0);
};
