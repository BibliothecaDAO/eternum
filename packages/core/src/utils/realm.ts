import { ClientComponents, ID, RealmInfo } from "@bibliothecadao/types";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { configManager, getAddressNameFromEntity, ResourceManager, DEFAULT_COORD_ALT } from "..";
import realmsJson from "../data/realms.json";
import { unpackValue } from "./packed-data";

export const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson["features"][realmId - 1];
  if (!features) return "";
  return features["name"];
};

export function getRealmInfo(entity: Entity, components: ClientComponents): RealmInfo | undefined {
  const structure = getComponentValue(components.Structure, entity);
  const structureBuildings = getComponentValue(components.StructureBuildings, entity);

  if (structure) {
    const realm_id = structure.metadata.realm_id;
    const order = structure.metadata.order;
    const level = structure.base.level;
    const entity_id = structure.entity_id;
    const produced_resources = structure.resources_packed;

    const resources = unpackValue(BigInt(produced_resources));

    const resourceManager = new ResourceManager(components, entity_id);

    return {
      realmId: realm_id,
      entityId: entity_id,
      category: structure.category,
      level,
      resources,
      order,
      storehouses: resourceManager.getStoreCapacityKg(),
      position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
      population: structureBuildings?.population.current,
      capacity: structureBuildings?.population.max,
      hasCapacity:
        !structureBuildings?.population ||
        structureBuildings.population.max + configManager.getBasePopulationCapacity() >
          structureBuildings.population.current,
      owner: structure?.owner,
      ownerName: getAddressNameFromEntity(entity_id, components) || "",
      hasWonder: structure.metadata.has_wonder,
      structure,
    };
  }
}

export const hasEnoughPopulationForBuilding = (realm: any, building: number) => {
  const buildingPopulation = configManager.getBuildingCategoryConfig(building).population_cost;
  const basePopulationCapacity = configManager.getBasePopulationCapacity();

  return (realm?.population || 0) + buildingPopulation <= basePopulationCapacity + (realm?.capacity || 0);
};

export const maxLayer = (realmCount: number): number => {
  // Calculate the maximum layer on the concentric hexagon
  // that can be built on based on realm count

  if (realmCount <= 1500) {
    return 26; // 2105 capacity
  }

  if (realmCount <= 2500) {
    return 32; // 3167 capacity
  }

  if (realmCount <= 3500) {
    return 37; // 4217 capacity
  }

  if (realmCount <= 4500) {
    return 41; // 5165 capacity
  }

  if (realmCount <= 5500) {
    return 45; // 6209 capacity
  }

  if (realmCount <= 6500) {
    return 49; // 7349 capacity
  }

  return 52; // 8267 capacity
};
