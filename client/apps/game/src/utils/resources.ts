import useUIStore from "@/hooks/store/use-ui-store";
import { unpackResources } from "@/ui/utils/packed-data";
import {
  ClientComponents,
  configManager,
  getStartingResources,
  ID,
  Resource,
  ResourceManager,
  resources,
} from "@bibliothecadao/eternum";
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

export const getQuestResources = (realmEntityId: ID, components: ClientComponents) => {
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const resourcesProduced = realm ? unpackResources(realm.produced_resources) : [];
  return getStartingResources(resourcesProduced);
};
