import useUIStore from "@/hooks/store/use-ui-store";
import { unpackResources } from "@/ui/utils/packed-data";
import {
  ClientComponents,
  configManager,
  getQuestResources as getStartingResources,
  ID,
  Resource,
  ResourceManager,
  resources,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ETERNUM_CONFIG } from "./config";


 const eternumConfig = await ETERNUM_CONFIG();
// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(id)]));
      if (resource?.balance !== undefined && resource.balance > 0n) {
        return { resourceId: id, amount: Number(resource.balance) };
      }
      return undefined;
    })
    .filter((resource): resource is Resource => resource !== undefined);
};

// for entities that have production like realms
export const getBalance = (entityId: ID, resourceId: ResourcesIds, components: ClientComponents) => {
  const currentDefaultTick = useUIStore.getState().currentDefaultTick;
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return { balance: resourceManager.balance(currentDefaultTick), resourceId };
};

export const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds, components: ClientComponents) => {
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return resourceManager.getProduction();
};

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
  return getStartingResources(resourcesProduced, eternumConfig.questResources, eternumConfig.resources.resourceInputs);
};
