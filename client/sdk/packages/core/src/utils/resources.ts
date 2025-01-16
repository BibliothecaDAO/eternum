import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getStartingResources } from ".";
import { BuildingType, resources, ResourcesIds } from "../constants";
import { ClientComponents } from "../dojo";
import { ResourceManager } from "../modelManager";
import { ClientConfigManager, configManager } from "../modelManager/ConfigManager";
import { ID, Resource } from "../types";
import { unpackResources } from "./packed-data";

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
export const getBalance = (
  entityId: ID,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return { balance: resourceManager.balance(currentDefaultTick), resourceId };
};

export const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds, components: ClientComponents) => {
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return resourceManager.getProduction();
};

export const getResourcesFromBalance = (
  entityId: ID,
  currentDefaultTick: number,
  components: ClientComponents,
): Resource[] => {
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

export const getTotalResourceWeight = (resources: Array<Resource | undefined>) => {
  const configManager = ClientConfigManager.instance();

  return resources.reduce(
    (total, resource) =>
      total + (resource ? resource.amount * configManager.getResourceWeight(resource.resourceId) || 0 : 0),
    0,
  );
};

export const isResourceProductionBuilding = (buildingId: BuildingType) => {
  return (
    buildingId === BuildingType.Resource ||
    buildingId === BuildingType.Farm ||
    buildingId === BuildingType.FishingVillage ||
    buildingId === BuildingType.Barracks ||
    buildingId === BuildingType.ArcheryRange ||
    buildingId === BuildingType.Stable
  );
};
