import { DojoResult } from "@/hooks/context/DojoContext";
import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  BUILDING_RESOURCE_PRODUCED,
  BuildingType,
  HYPERSTRUCTURE_CONFIG_ID,
  HyperstructureResourceMultipliers,
  POPULATION_CONFIG_ID,
  QUEST_RESOURCES,
  RESOURCE_PRECISION,
  ResourceInputs,
  ResourcesIds,
  scaleResourceInputs,
  STARTING_RESOURCES_INPUT_PRODUCTION_FACTOR,
  StructureType,
  TickIds,
  TravelTypes,
  uniqueResourceInputs,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private dojo!: DojoResult;

  private dojoCheck() {
    if (!this.dojo) {
      console.warn("Dojo configuration not set. Call setDojo() first.");
      return 0;
    }
  }

  public setDojo(dojoConfig: DojoResult) {
    this.dojo = dojoConfig;
  }

  public static instance(): ClientConfigManager {
    if (!ClientConfigManager._instance) {
      ClientConfigManager._instance = new ClientConfigManager();
    }
    return ClientConfigManager._instance;
  }

  public getResourceWeight(resourceId: number): number {
    this.dojoCheck();

    const entity = getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(resourceId)]);
    const weightConfig = getComponentValue(this.dojo.setup.components.WeightConfig, entity);
    return Number(weightConfig?.weight_gram ?? 0);
  }

  public getTravelStaminaCost(travelType: TravelTypes): number {
    this.dojoCheck();
    return (
      getComponentValue(
        this.dojo.setup.components.TravelStaminaCostConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(travelType)]),
      )?.cost ?? 0
    );
  }

  public getExploreResourceCost(resourceId: ResourcesIds): number {
    this.dojoCheck();

    const resourceCostConfig = getComponentValue(
      this.dojo.setup.components.MapExploreConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    );

    switch (resourceId) {
      case ResourcesIds.Wheat:
        return Number(resourceCostConfig?.wheat_burn_amount ?? 0) / RESOURCE_PRECISION;
      case ResourcesIds.Fish:
        return Number(resourceCostConfig?.fish_burn_amount ?? 0) / RESOURCE_PRECISION;
      default:
        throw new Error(`Explore resource cost not found for resourceId: ${resourceId}`);
    }
  }

  public getExploreReward(): number {
    this.dojoCheck();

    const exploreConfig = getComponentValue(
      this.dojo.setup.components.MapExploreConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    );

    return Number(exploreConfig?.reward_resource_amount ?? 0) / RESOURCE_PRECISION;
  }

  public getExploreResourceCosts(): { [key: number]: number } {
    this.dojoCheck();

    let costs: { [key: number]: number } = {};

    costs[ResourcesIds.Wheat] = this.getExploreResourceCost(ResourcesIds.Wheat);
    costs[ResourcesIds.Fish] = this.getExploreResourceCost(ResourcesIds.Fish);

    return costs;
  }

  public getHyperstructureTotalCosts(): {
    resource: ResourcesIds;
    amount: number;
  }[] {
    this.dojoCheck();

    return useMemo(() => {
      const hyperstructureTotalCosts: { resource: ResourcesIds; amount: number }[] = [];

      for (const resourceId of Object.values(ResourcesIds).filter(Number.isInteger)) {
        const entity = getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, BigInt(resourceId)]);
        const amount =
          Number(
            getComponentValue(this.dojo.setup.components.HyperstructureResourceConfig, entity)?.amount_for_completion ??
              0,
          ) / RESOURCE_PRECISION;
        hyperstructureTotalCosts.push({ resource: resourceId as ResourcesIds, amount });

        if (resourceId === ResourcesIds.Earthenshard) {
          break;
        }
      }

      return hyperstructureTotalCosts;
    }, [this.dojo]);
  }

  public getTotalContributableAmount(): number {
    this.dojoCheck();

    return this.getHyperstructureTotalCosts().reduce((total, { resource, amount }) => {
      return total + (HyperstructureResourceMultipliers[resource] ?? 0) * amount;
    }, 0);
  }

  public getStartingResources = (resourcesOnRealm: number[]): ResourceInputs => {
    let QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(QUEST_RESOURCES, RESOURCE_PRECISION);
    return this.applyInputProductionFactor(QUEST_RESOURCES_SCALED, resourcesOnRealm);
  };

  private applyInputProductionFactor = (questResources: ResourceInputs, resourcesOnRealm: number[]): ResourceInputs => {
    for (let resourceInput of uniqueResourceInputs(resourcesOnRealm).filter(
      (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
    )) {
      for (let questType in questResources) {
        questResources[questType] = questResources[questType].map((questResource) => {
          if (questResource.resource === resourceInput) {
            return {
              ...questResource,
              amount: questResource.amount * STARTING_RESOURCES_INPUT_PRODUCTION_FACTOR,
            };
          }
          return questResource;
        });
      }
    }
    return questResources;
  };

  public getBuildingPopConfig(buildingId: BuildingType): {
    population: number;
    capacity: number;
  } {
    this.dojoCheck();

    const buildingConfig = getComponentValue(
      this.dojo.setup.components.BuildingCategoryPopConfig,
      getEntityIdFromKeys([BUILDING_CATEGORY_POPULATION_CONFIG_ID, BigInt(buildingId)]),
    );

    return {
      population: buildingConfig?.population ?? 0,
      capacity: buildingConfig?.capacity ?? 0,
    };
  }

  public getTroopTypeStamina(troopId: ResourcesIds): number {
    this.dojoCheck();

    return (
      getComponentValue(
        this.dojo.setup.components.StaminaConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(troopId)]),
      )?.max_stamina ?? 0
    );
  }

  public getTick(tickId: TickIds) {
    this.dojoCheck();

    return Number(
      getComponentValue(this.dojo.setup.components.TickConfig, getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(tickId)]))
        ?.tick_interval_in_seconds || 0,
    );
  }

  public getBasePopulationCapacity(): number {
    this.dojoCheck();

    return (
      getComponentValue(this.dojo.setup.components.PopulationConfig, getEntityIdFromKeys([POPULATION_CONFIG_ID]))
        ?.base_population ?? 0
    );
  }

  public getCarryCapacity(entity_type: number): number {
    this.dojoCheck();

    return Number(
      getComponentValue(
        this.dojo.setup.components.CapacityConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(entity_type)]),
      )?.weight_gram ?? 0,
    );
  }

  public getTroopConfig() {
    this.dojoCheck();

    const troopConfig = getComponentValue(
      this.dojo.setup.components.TroopConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    );

    return {
      health: troopConfig?.health ?? 0,
      knightStrength: troopConfig?.knight_strength ?? 0,
      paladinStrength: troopConfig?.paladin_strength ?? 0,
      crossbowmanStrength: troopConfig?.crossbowman_strength ?? 0,
      advantagePercent: troopConfig?.advantage_percent ?? 0,
      disadvantagePercent: troopConfig?.disadvantage_percent ?? 0,
      pillageHealthDivisor: troopConfig?.pillage_health_divisor ?? 0,
      armyFreePerStructure: troopConfig?.army_free_per_structure ?? 0,
      armyExtraPerBuilding: troopConfig?.army_extra_per_building ?? 0,
    };
  }

  public getBuildingCost(buildingId: BuildingType): { resource: ResourcesIds; amount: number }[] {
    this.dojoCheck();

    const resourceType = BUILDING_RESOURCE_PRODUCED[buildingId];

    const buildingConfig = getComponentValue(
      this.dojo.setup.components.BuildingConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(buildingId), BigInt(resourceType)]),
    );

    const resourceCostCount = buildingConfig?.resource_cost_count || 0;
    const resourceCostId = buildingConfig?.resource_cost_id || 0;

    const resourceCosts: { resource: ResourcesIds; amount: number }[] = [];
    for (let index = 0; index < resourceCostCount; index++) {
      const resourceCost = getComponentValue(
        this.dojo.setup.components.ResourceCost,
        getEntityIdFromKeys([BigInt(resourceCostId), BigInt(index)]),
      );
      if (!resourceCost) {
        continue;
      }

      const resourceType = resourceCost.resource_type;
      const amount = Number(resourceCost.amount) / RESOURCE_PRECISION;

      resourceCosts.push({ resource: resourceType, amount });
    }
    return resourceCosts;
  }

  public getResourceBuildingCost(resourceId: ResourcesIds): { resource: ResourcesIds; amount: number }[] {
    this.dojoCheck();

    const buildingConfig = getComponentValue(
      this.dojo.setup.components.BuildingConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(BuildingType.Resource), BigInt(resourceId)]),
    );

    const resourceCostCount = buildingConfig?.resource_cost_count || 0;
    const resourceCostId = buildingConfig?.resource_cost_id || 0;

    const resourceCosts: { resource: ResourcesIds; amount: number }[] = [];
    for (let index = 0; index < resourceCostCount; index++) {
      const resourceCost = getComponentValue(
        this.dojo.setup.components.ResourceCost,
        getEntityIdFromKeys([BigInt(resourceCostId), BigInt(index)]),
      );
      if (!resourceCost) {
        continue;
      }

      const resourceType = resourceCost.resource_type;
      const amount = Number(resourceCost.amount) / RESOURCE_PRECISION;

      resourceCosts.push({ resource: resourceType, amount });
    }
    return resourceCosts;
  }

  public getAllBuildingCosts(): ResourceInputs {
    this.dojoCheck();
    return Object.values(BuildingType)
      .filter((value): value is BuildingType => typeof value === "number")
      .reduce((acc, buildingType) => {
        const costs = this.getBuildingCost(buildingType);
        acc[buildingType] = costs;
        return acc;
      }, {} as ResourceInputs);
  }

  public getStructureCosts(type: StructureType) {
    this.dojoCheck();

    switch (type) {
      case StructureType["Hyperstructure"]:
        return this.getHyperstructureTotalCosts();
      default:
        return [];
    }
  }

  // TODO: Fix this
  public getResourceInputs(resourceType: number): {
    resource: ResourcesIds;
    amount: number;
  }[] {
    this.dojoCheck();

    const productionConfig = getComponentValue(
      this.dojo.setup.components.ProductionConfig,
      getEntityIdFromKeys([BigInt(resourceType)]),
    );

    const input_count = productionConfig?.input_count ?? 0;
    const inputs: { resource: ResourcesIds; amount: number }[] = [];

    for (let index = 0; index < input_count; index++) {
      const productionInput = getComponentValue(
        this.dojo.setup.components.ProductionInput,
        getEntityIdFromKeys([BigInt(resourceType), BigInt(index)]),
      );

      if (productionInput) {
        const resource = productionInput.input_resource_type;
        const amount = Number(productionInput.input_resource_amount);
        inputs.push({ resource, amount });
      }
    }

    return inputs;
  }

  public getResourceOutputs(resourceType: number): number {
    this.dojoCheck();

    const productionConfig = getComponentValue(
      this.dojo.setup.components.ProductionConfig,
      getEntityIdFromKeys([BigInt(resourceType)]),
    );

    return Number(productionConfig?.amount ?? 0);
  }

  public getBuildingResourceProduced(buildingId: BuildingType): number {
    return BUILDING_RESOURCE_PRODUCED[buildingId];
  }

  public getBankConfig() {
    this.dojoCheck();

    const bankConfig = getComponentValue(this.dojo.setup.components.BankConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return {
      lordsCost: Number(bankConfig?.lords_cost ?? 0) / RESOURCE_PRECISION,
      lpFeesNumerator: Number(bankConfig?.lp_fee_num ?? 0),
      lpFeesDenominator: Number(bankConfig?.lp_fee_denom ?? 0),
    };
  }

  public getSpeedConfig(entityType: number): number {
    this.dojoCheck();

    const speedConfig = getComponentValue(
      this.dojo.setup.components.SpeedConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(entityType)]),
    );

    return speedConfig?.sec_per_km ?? 0;
  }
}
