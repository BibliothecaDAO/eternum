import {
  type ClientComponents,
  type HyperstructureResourceCostMinMax,
  type ID,
  RESOURCE_PRECISION,
  type Resource,
  type ResourceCostMinMax,
  type ResourceInputs,
  type ResourceOutputs,
  ResourcesIds,
  StructureType,
  resources,
} from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ResourceManager } from "../managers";
import { unpackValue } from "./packed-data";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resourceManager = new ResourceManager(components, entityId);
      const balance = resourceManager.balance(id);
      if (balance > 0) {
        return { resourceId: id, amount: Number(balance) };
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
  const resourceManager = new ResourceManager(components, entityId);
  return {
    balance: resourceManager.balanceWithProduction(currentDefaultTick, resourceId),
    resourceId,
  };
};

export const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds, components: ClientComponents) => {
  const resourceManager = new ResourceManager(components, entityId);
  return resourceManager.getProduction(resourceId);
};

export const getResourcesFromBalance = (
  entityId: ID,
  currentDefaultTick: number,
  components: ClientComponents,
): Resource[] => {
  // todo: improve optimisation
  const resourceIds = resources.map((r) => r.id);
  return resourceIds
    .map((id) => {
      const resourceManager = new ResourceManager(components, entityId);
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, id);
      return { resourceId: id, amount: balance };
    })
    .filter((r) => r.amount > 0);
};

export const getQuestResources = (realmEntityId: ID, components: ClientComponents) => {
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const resourcesProduced = structure ? unpackValue(structure.resources_packed) : [];

  // todo: fix
  return getStartingResources(resourcesProduced, [], []);
};

export const scaleResourceInputs = (resourceInputs: ResourceInputs, multiplier: number) => {
  const multipliedCosts: ResourceInputs = {};

  for (const buildingType in resourceInputs) {
    multipliedCosts[buildingType] = resourceInputs[buildingType].map((resourceInput) => ({
      ...resourceInput,
      amount: Math.round(resourceInput.amount * multiplier),
    }));
  }

  return multipliedCosts;
};

export const scaleResources = (resources: any[], multiplier: number): any[] => {
  return resources.map((resource) => ({
    ...resource,
    amount: resource.amount * multiplier,
  }));
};

export const uniqueResourceInputs = (
  resourcesProduced: number[],
  resourceProductionInputResources: ResourceInputs,
): number[] => {
  const uniqueResourceInputs: number[] = [];

  for (const resourceProduced of resourcesProduced) {
    for (const resourceInput of resourceProductionInputResources[resourceProduced]) {
      if (!uniqueResourceInputs.includes(resourceInput.resource)) {
        uniqueResourceInputs.push(resourceInput.resource);
      }
    }
  }

  return uniqueResourceInputs;
};

export const applyInputProductionFactor = (
  questResources: ResourceInputs,
  resourcesOnRealm: number[],
  resourceProductionInputResources: ResourceInputs,
): ResourceInputs => {
  for (const resourceInput of uniqueResourceInputs(resourcesOnRealm, resourceProductionInputResources).filter(
    (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
  )) {
    for (const questType in questResources) {
      questResources[questType] = questResources[questType].map((questResource) => {
        if (questResource.resource === resourceInput) {
          return {
            ...questResource,
            amount: questResource.amount * RESOURCE_PRECISION,
          };
        }
        return questResource;
      });
    }
  }
  return questResources;
};

export const getStartingResources = (
  resourcesOnRealm: number[],
  questResources: ResourceInputs,
  resourceProductionInputResources: ResourceInputs,
): ResourceInputs => {
  const QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(questResources, RESOURCE_PRECISION);
  return applyInputProductionFactor(QUEST_RESOURCES_SCALED, resourcesOnRealm, resourceProductionInputResources);
};

export const scaleResourceCostMinMax = (
  resourceCost: ResourceCostMinMax[],
  multiplier: number,
): ResourceCostMinMax[] => {
  return resourceCost.map((resource) => ({
    ...resource,
    min_amount: resource.min_amount * multiplier,
    max_amount: resource.max_amount * multiplier,
  }));
};

export const scaleHyperstructureConstructionCostMinMax = (
  resourceCost: HyperstructureResourceCostMinMax[],
  multiplier: number,
): HyperstructureResourceCostMinMax[] => {
  return resourceCost.map((resource) => ({
    ...resource,
    min_amount: resource.min_amount * multiplier,
    max_amount: resource.max_amount * multiplier,
  }));
};

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  const multipliedCosts: ResourceOutputs = {};

  for (const buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
  }
  return multipliedCosts;
};

export const isMilitaryResource = (resourceId: ResourcesIds) => {
  return (
    resourceId === ResourcesIds.Knight ||
    resourceId === ResourcesIds.KnightT2 ||
    resourceId === ResourcesIds.KnightT3 ||
    resourceId === ResourcesIds.Paladin ||
    resourceId === ResourcesIds.PaladinT2 ||
    resourceId === ResourcesIds.PaladinT3 ||
    resourceId === ResourcesIds.Crossbowman ||
    resourceId === ResourcesIds.CrossbowmanT2 ||
    resourceId === ResourcesIds.CrossbowmanT3
  );
};

export const canTransferMilitaryResources = (fromEntityId: ID, toEntityId: ID, components: ClientComponents) => {
  const fromStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(fromEntityId)]));

  const toStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(toEntityId)]));

  // If from structure is a village, can only transfer to its connected realm
  if (fromStructure?.category === StructureType.Village) {
    return toStructure?.entity_id === fromStructure.metadata.village_realm;
  }

  // If to structure is a village, can only transfer from its connected realm
  if (toStructure?.category === StructureType.Village) {
    return fromStructure?.entity_id === toStructure.metadata.village_realm;
  }

  // Otherwise, transfer is allowed
  return true;
};

export const getResourcesFromToriiEntity = (entity: any): ComponentValue<ClientComponents["Resource"]["schema"]> => {
  return {
    entity_id: entity.entity_id.value,
    STONE_BALANCE: BigInt(entity.STONE_BALANCE.value),
    COAL_BALANCE: BigInt(entity.COAL_BALANCE.value),
    WOOD_BALANCE: BigInt(entity.WOOD_BALANCE.value),
    COPPER_BALANCE: BigInt(entity.COPPER_BALANCE.value),
    IRONWOOD_BALANCE: BigInt(entity.IRONWOOD_BALANCE.value),
    OBSIDIAN_BALANCE: BigInt(entity.OBSIDIAN_BALANCE.value),
    GOLD_BALANCE: BigInt(entity.GOLD_BALANCE.value),
    SILVER_BALANCE: BigInt(entity.SILVER_BALANCE.value),
    MITHRAL_BALANCE: BigInt(entity.MITHRAL_BALANCE.value),
    ALCHEMICAL_SILVER_BALANCE: BigInt(entity.ALCHEMICAL_SILVER_BALANCE.value),
    COLD_IRON_BALANCE: BigInt(entity.COLD_IRON_BALANCE.value),
    DEEP_CRYSTAL_BALANCE: BigInt(entity.DEEP_CRYSTAL_BALANCE.value),
    RUBY_BALANCE: BigInt(entity.RUBY_BALANCE.value),
    DIAMONDS_BALANCE: BigInt(entity.DIAMONDS_BALANCE.value),
    HARTWOOD_BALANCE: BigInt(entity.HARTWOOD_BALANCE.value),
    IGNIUM_BALANCE: BigInt(entity.IGNIUM_BALANCE.value),
    TWILIGHT_QUARTZ_BALANCE: BigInt(entity.TWILIGHT_QUARTZ_BALANCE.value),
    TRUE_ICE_BALANCE: BigInt(entity.TRUE_ICE_BALANCE.value),
    ADAMANTINE_BALANCE: BigInt(entity.ADAMANTINE_BALANCE.value),
    SAPPHIRE_BALANCE: BigInt(entity.SAPPHIRE_BALANCE.value),
    ETHEREAL_SILICA_BALANCE: BigInt(entity.ETHEREAL_SILICA_BALANCE.value),
    DRAGONHIDE_BALANCE: BigInt(entity.DRAGONHIDE_BALANCE.value),
    LABOR_BALANCE: BigInt(entity.LABOR_BALANCE.value),
    EARTHEN_SHARD_BALANCE: BigInt(entity.EARTHEN_SHARD_BALANCE.value),
    DONKEY_BALANCE: BigInt(entity.DONKEY_BALANCE.value),
    KNIGHT_T1_BALANCE: BigInt(entity.KNIGHT_T1_BALANCE.value),
    KNIGHT_T2_BALANCE: BigInt(entity.KNIGHT_T2_BALANCE.value),
    KNIGHT_T3_BALANCE: BigInt(entity.KNIGHT_T3_BALANCE.value),
    CROSSBOWMAN_T1_BALANCE: BigInt(entity.CROSSBOWMAN_T1_BALANCE.value),
    CROSSBOWMAN_T2_BALANCE: BigInt(entity.CROSSBOWMAN_T2_BALANCE.value),
    CROSSBOWMAN_T3_BALANCE: BigInt(entity.CROSSBOWMAN_T3_BALANCE.value),
    PALADIN_T1_BALANCE: BigInt(entity.PALADIN_T1_BALANCE.value),
    PALADIN_T2_BALANCE: BigInt(entity.PALADIN_T2_BALANCE.value),
    PALADIN_T3_BALANCE: BigInt(entity.PALADIN_T3_BALANCE.value),
    WHEAT_BALANCE: BigInt(entity.WHEAT_BALANCE.value),
    FISH_BALANCE: BigInt(entity.FISH_BALANCE.value),
    LORDS_BALANCE: BigInt(entity.LORDS_BALANCE.value),
    weight: {
      capacity: BigInt(entity.weight.value.capacity.value),
      weight: BigInt(entity.weight.value.weight.value),
    },
    STONE_PRODUCTION: {
      building_count: entity.STONE_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.STONE_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.STONE_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.STONE_PRODUCTION.value.last_updated_at.value,
    },
    COAL_PRODUCTION: {
      building_count: entity.COAL_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.COAL_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.COAL_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.COAL_PRODUCTION.value.last_updated_at.value,
    },
    WOOD_PRODUCTION: {
      building_count: entity.WOOD_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.WOOD_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.WOOD_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.WOOD_PRODUCTION.value.last_updated_at.value,
    },
    COPPER_PRODUCTION: {
      building_count: entity.COPPER_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.COPPER_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.COPPER_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.COPPER_PRODUCTION.value.last_updated_at.value,
    },
    IRONWOOD_PRODUCTION: {
      building_count: entity.IRONWOOD_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.IRONWOOD_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.IRONWOOD_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.IRONWOOD_PRODUCTION.value.last_updated_at.value,
    },
    OBSIDIAN_PRODUCTION: {
      building_count: entity.OBSIDIAN_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.OBSIDIAN_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.OBSIDIAN_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.OBSIDIAN_PRODUCTION.value.last_updated_at.value,
    },
    GOLD_PRODUCTION: {
      building_count: entity.GOLD_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.GOLD_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.GOLD_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.GOLD_PRODUCTION.value.last_updated_at.value,
    },
    SILVER_PRODUCTION: {
      building_count: entity.SILVER_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.SILVER_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.SILVER_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.SILVER_PRODUCTION.value.last_updated_at.value,
    },
    MITHRAL_PRODUCTION: {
      building_count: entity.MITHRAL_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.MITHRAL_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.MITHRAL_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.MITHRAL_PRODUCTION.value.last_updated_at.value,
    },
    ALCHEMICAL_SILVER_PRODUCTION: {
      building_count: entity.ALCHEMICAL_SILVER_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.ALCHEMICAL_SILVER_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.ALCHEMICAL_SILVER_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.ALCHEMICAL_SILVER_PRODUCTION.value.last_updated_at.value,
    },
    COLD_IRON_PRODUCTION: {
      building_count: entity.COLD_IRON_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.COLD_IRON_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.COLD_IRON_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.COLD_IRON_PRODUCTION.value.last_updated_at.value,
    },
    DEEP_CRYSTAL_PRODUCTION: {
      building_count: entity.DEEP_CRYSTAL_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.DEEP_CRYSTAL_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.DEEP_CRYSTAL_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.DEEP_CRYSTAL_PRODUCTION.value.last_updated_at.value,
    },
    RUBY_PRODUCTION: {
      building_count: entity.RUBY_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.RUBY_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.RUBY_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.RUBY_PRODUCTION.value.last_updated_at.value,
    },
    DIAMONDS_PRODUCTION: {
      building_count: entity.DIAMONDS_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.DIAMONDS_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.DIAMONDS_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.DIAMONDS_PRODUCTION.value.last_updated_at.value,
    },
    HARTWOOD_PRODUCTION: {
      building_count: entity.HARTWOOD_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.HARTWOOD_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.HARTWOOD_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.HARTWOOD_PRODUCTION.value.last_updated_at.value,
    },
    IGNIUM_PRODUCTION: {
      building_count: entity.IGNIUM_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.IGNIUM_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.IGNIUM_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.IGNIUM_PRODUCTION.value.last_updated_at.value,
    },
    TWILIGHT_QUARTZ_PRODUCTION: {
      building_count: entity.TWILIGHT_QUARTZ_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.TWILIGHT_QUARTZ_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.TWILIGHT_QUARTZ_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.TWILIGHT_QUARTZ_PRODUCTION.value.last_updated_at.value,
    },
    TRUE_ICE_PRODUCTION: {
      building_count: entity.TRUE_ICE_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.TRUE_ICE_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.TRUE_ICE_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.TRUE_ICE_PRODUCTION.value.last_updated_at.value,
    },
    ADAMANTINE_PRODUCTION: {
      building_count: entity.ADAMANTINE_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.ADAMANTINE_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.ADAMANTINE_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.ADAMANTINE_PRODUCTION.value.last_updated_at.value,
    },
    SAPPHIRE_PRODUCTION: {
      building_count: entity.SAPPHIRE_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.SAPPHIRE_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.SAPPHIRE_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.SAPPHIRE_PRODUCTION.value.last_updated_at.value,
    },
    ETHEREAL_SILICA_PRODUCTION: {
      building_count: entity.ETHEREAL_SILICA_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.ETHEREAL_SILICA_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.ETHEREAL_SILICA_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.ETHEREAL_SILICA_PRODUCTION.value.last_updated_at.value,
    },
    DRAGONHIDE_PRODUCTION: {
      building_count: entity.DRAGONHIDE_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.DRAGONHIDE_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.DRAGONHIDE_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.DRAGONHIDE_PRODUCTION.value.last_updated_at.value,
    },
    LABOR_PRODUCTION: {
      building_count: entity.LABOR_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.LABOR_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.LABOR_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.LABOR_PRODUCTION.value.last_updated_at.value,
    },
    EARTHEN_SHARD_PRODUCTION: {
      building_count: entity.EARTHEN_SHARD_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.EARTHEN_SHARD_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.EARTHEN_SHARD_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.EARTHEN_SHARD_PRODUCTION.value.last_updated_at.value,
    },
    DONKEY_PRODUCTION: {
      building_count: entity.DONKEY_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.DONKEY_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.DONKEY_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.DONKEY_PRODUCTION.value.last_updated_at.value,
    },
    KNIGHT_T1_PRODUCTION: {
      building_count: entity.KNIGHT_T1_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.KNIGHT_T1_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.KNIGHT_T1_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.KNIGHT_T1_PRODUCTION.value.last_updated_at.value,
    },
    KNIGHT_T2_PRODUCTION: {
      building_count: entity.KNIGHT_T2_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.KNIGHT_T2_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.KNIGHT_T2_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.KNIGHT_T2_PRODUCTION.value.last_updated_at.value,
    },
    KNIGHT_T3_PRODUCTION: {
      building_count: entity.KNIGHT_T3_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.KNIGHT_T3_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.KNIGHT_T3_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.KNIGHT_T3_PRODUCTION.value.last_updated_at.value,
    },
    CROSSBOWMAN_T1_PRODUCTION: {
      building_count: entity.CROSSBOWMAN_T1_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.CROSSBOWMAN_T1_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.CROSSBOWMAN_T1_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.CROSSBOWMAN_T1_PRODUCTION.value.last_updated_at.value,
    },
    CROSSBOWMAN_T2_PRODUCTION: {
      building_count: entity.CROSSBOWMAN_T2_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.CROSSBOWMAN_T2_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.CROSSBOWMAN_T2_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.CROSSBOWMAN_T2_PRODUCTION.value.last_updated_at.value,
    },
    CROSSBOWMAN_T3_PRODUCTION: {
      building_count: entity.CROSSBOWMAN_T3_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.CROSSBOWMAN_T3_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.CROSSBOWMAN_T3_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.CROSSBOWMAN_T3_PRODUCTION.value.last_updated_at.value,
    },
    PALADIN_T1_PRODUCTION: {
      building_count: entity.PALADIN_T1_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.PALADIN_T1_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.PALADIN_T1_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.PALADIN_T1_PRODUCTION.value.last_updated_at.value,
    },
    PALADIN_T2_PRODUCTION: {
      building_count: entity.PALADIN_T2_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.PALADIN_T2_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.PALADIN_T2_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.PALADIN_T2_PRODUCTION.value.last_updated_at.value,
    },
    PALADIN_T3_PRODUCTION: {
      building_count: entity.PALADIN_T3_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.PALADIN_T3_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.PALADIN_T3_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.PALADIN_T3_PRODUCTION.value.last_updated_at.value,
    },
    WHEAT_PRODUCTION: {
      building_count: entity.WHEAT_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.WHEAT_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.WHEAT_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.WHEAT_PRODUCTION.value.last_updated_at.value,
    },
    FISH_PRODUCTION: {
      building_count: entity.FISH_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.FISH_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.FISH_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.FISH_PRODUCTION.value.last_updated_at.value,
    },
    LORDS_PRODUCTION: {
      building_count: entity.LORDS_PRODUCTION.value.building_count.value,
      production_rate: BigInt(entity.LORDS_PRODUCTION.value.production_rate.value),
      output_amount_left: BigInt(entity.LORDS_PRODUCTION.value.output_amount_left.value),
      last_updated_at: entity.LORDS_PRODUCTION.value.last_updated_at.value,
    },
  };
};

export const getFood = (
  resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
  currentDefaultTick: number,
) => {
  const wheat = ResourceManager.balanceWithProduction(resource, currentDefaultTick, ResourcesIds.Wheat);
  const fish = ResourceManager.balanceWithProduction(resource, currentDefaultTick, ResourcesIds.Fish);
  return {
    wheat,
    fish,
  };
};
