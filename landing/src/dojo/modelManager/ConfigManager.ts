import { divideByPrecision } from "@/components/ui/utils/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  BuildingType,
  CapacityConfigCategory,
  EternumGlobalConfig,
  GET_HYPERSTRUCTURE_RESOURCES_PER_TIER,
  HYPERSTRUCTURE_CONFIG_ID,
  POPULATION_CONFIG_ID,
  ResourcesIds,
  ResourceTier,
  StructureType,
  TickIds,
  TravelTypes,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ContractComponents } from "../contractComponents";
import { configManager } from "../setup";

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private components!: ContractComponents;

  resourceInputs: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  resourceOutput: Record<number, { resource: ResourcesIds; amount: number }> = {};
  hyperstructureTotalCosts: Record<number, { resource: ResourceTier; min_amount: number; max_amount: number }> = {};
  realmUpgradeCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  buildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  resourceBuildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  structureCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};

  public setDojo(components: ContractComponents) {
    this.components = components;
    this.initializeResourceInputs();
    this.initializeResourceOutput();
    this.initializeHyperstructureTotalCosts();
    this.initializeRealmUpgradeCosts();
    this.initializeResourceBuildingCosts();
    this.initializeBuildingCosts();
    this.initializeStructureCosts();
  }

  public static instance(): ClientConfigManager {
    if (!ClientConfigManager._instance) {
      ClientConfigManager._instance = new ClientConfigManager();
    }

    return ClientConfigManager._instance;
  }

  private getValueOrDefault<T>(callback: () => T, defaultValue: T): T {
    if (!this.components) {
      return defaultValue;
    }
    return callback();
  }

  private initializeResourceInputs() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const productionConfig = getComponentValue(
        this.components.ProductionConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );

      const inputCount = productionConfig?.input_count ?? 0;
      const inputs: { resource: ResourcesIds; amount: number }[] = [];

      for (let index = 0; index < inputCount; index++) {
        const productionInput = getComponentValue(
          this.components.ProductionInput,
          getEntityIdFromKeys([BigInt(resourceType), BigInt(index)]),
        );

        if (productionInput) {
          const resource = productionInput.input_resource_type;
          const amount = divideByPrecision(Number(productionInput.input_resource_amount));
          inputs.push({ resource, amount });
        }
      }

      this.resourceInputs[Number(resourceType)] = inputs;
    }
  }

  private initializeResourceOutput() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const productionConfig = getComponentValue(
        this.components.ProductionConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );

      this.resourceOutput[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        amount: divideByPrecision(Number(productionConfig?.amount)),
      };
    }
  }

  private initializeHyperstructureTotalCosts() {
    const hyperstructureTotalCosts: { resource: ResourceTier; min_amount: number; max_amount: number }[] = [];

    for (const resourceTier of Object.values(ResourceTier).filter(Number.isInteger)) {
      const hyperstructureResourceConfig = getComponentValue(
        this.components.HyperstructureResourceConfig,
        getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, BigInt(resourceTier)]),
      );

      const min_amount =
        Number(hyperstructureResourceConfig?.min_amount ?? 0) / EternumGlobalConfig.resources.resourcePrecision;

      const max_amount =
        Number(hyperstructureResourceConfig?.max_amount ?? 0) / EternumGlobalConfig.resources.resourcePrecision;

      hyperstructureTotalCosts.push({ resource: resourceTier as ResourceTier, min_amount, max_amount });
    }

    this.hyperstructureTotalCosts = hyperstructureTotalCosts;
  }

  private initializeRealmUpgradeCosts() {
    const realmMaxLevel =
      getComponentValue(this.components.RealmMaxLevelConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.max_level ?? 0;

    for (let index = 1; index <= realmMaxLevel; index++) {
      const realmLevelConfig = getComponentValue(
        this.components.RealmLevelConfig,
        getEntityIdFromKeys([BigInt(index)]),
      );

      const resourcesCount = realmLevelConfig?.required_resource_count ?? 0;
      const detachedResourceId = realmLevelConfig?.required_resources_id ?? 0;

      const resources: { resource: ResourcesIds; amount: number }[] = [];

      for (let index = 0; index < resourcesCount; index++) {
        const resource = getComponentValue(
          this.components.DetachedResource,
          getEntityIdFromKeys([BigInt(detachedResourceId), BigInt(index)]),
        );
        if (resource) {
          const resourceId = resource.resource_type;
          const amount = divideByPrecision(Number(resource.resource_amount));
          resources.push({ resource: resourceId, amount });
        }
      }
      this.realmUpgradeCosts[index] = resources;
    }
  }

  private initializeResourceBuildingCosts() {
    for (const resourceId of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const buildingConfig = getComponentValue(
        this.components.BuildingConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(BuildingType.Resource), BigInt(resourceId)]),
      );

      const resourceCostCount = buildingConfig?.resource_cost_count || 0;
      const resourceCostId = buildingConfig?.resource_cost_id || 0;

      const resourceCosts: { resource: ResourcesIds; amount: number }[] = [];
      for (let index = 0; index < resourceCostCount; index++) {
        const resourceCost = getComponentValue(
          this.components.ResourceCost,
          getEntityIdFromKeys([BigInt(resourceCostId), BigInt(index)]),
        );
        if (!resourceCost) {
          continue;
        }

        const resourceType = resourceCost.resource_type;
        const amount = Number(resourceCost.amount) / EternumGlobalConfig.resources.resourcePrecision;

        resourceCosts.push({ resource: resourceType, amount });
      }
      this.resourceBuildingCosts[Number(resourceId)] = resourceCosts;
    }
  }

  private initializeBuildingCosts() {
    for (const buildingType of Object.values(BuildingType).filter(Number.isInteger)) {
      const resourceType = this.getResourceBuildingProduced(Number(buildingType));

      const buildingConfig = getComponentValue(
        this.components.BuildingConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(buildingType), BigInt(resourceType)]),
      );

      const resourceCostCount = buildingConfig?.resource_cost_count || 0;
      const resourceCostId = buildingConfig?.resource_cost_id || 0;

      const resourceCosts: { resource: ResourcesIds; amount: number }[] = [];
      for (let index = 0; index < resourceCostCount; index++) {
        const resourceCost = getComponentValue(
          this.components.ResourceCost,
          getEntityIdFromKeys([BigInt(resourceCostId), BigInt(index)]),
        );
        if (!resourceCost) {
          continue;
        }

        const resourceType = resourceCost.resource_type;
        const amount = Number(resourceCost.amount) / this.getResourcePrecision();

        resourceCosts.push({ resource: resourceType, amount });
      }
      this.buildingCosts[Number(buildingType)] = resourceCosts;
    }
  }

  private initializeStructureCosts() {
    this.structureCosts[StructureType.Hyperstructure] = [this.getHyperstructureConstructionCosts()];
  }

  private getHyperstructureConstructionCosts() {
    const hyperstructureResourceConfig = getComponentValue(
      this.components.HyperstructureResourceConfig,
      getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, BigInt(ResourceTier.Lords)]),
    );

    return {
      amount: divideByPrecision(Number(hyperstructureResourceConfig?.min_amount) ?? 0),
      resource: ResourcesIds.AncientFragment,
    };
  }

  getResourceWeight(resourceId: number): number {
    return this.getValueOrDefault(() => {
      const weightConfig = getComponentValue(
        this.components.WeightConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(resourceId)]),
      );
      return Number(weightConfig?.weight_gram ?? 0);
    }, 0);
  }

  getTravelStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.TravelStaminaCostConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Travel)]),
      );
      return staminaConfig?.cost ?? 0;
    }, 1);
  }

  getExploreStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.TravelStaminaCostConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Explore)]),
      );
      return staminaConfig?.cost ?? 0;
    }, 1);
  }

  getExploreReward() {
    return this.getValueOrDefault(() => {
      const exploreConfig = getComponentValue(this.components.MapConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

      return divideByPrecision(Number(exploreConfig?.reward_resource_amount ?? 0));
    }, 0);
  }

  getTroopConfig() {
    return this.getValueOrDefault(
      () => {
        const troopConfig = getComponentValue(this.components.TroopConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

        return {
          health: troopConfig?.health ?? 0,
          knightStrength: troopConfig?.knight_strength ?? 0,
          paladinStrength: troopConfig?.paladin_strength ?? 0,
          crossbowmanStrength: troopConfig?.crossbowman_strength ?? 0,
          advantagePercent: troopConfig?.advantage_percent ?? 0,
          disadvantagePercent: troopConfig?.disadvantage_percent ?? 0,
          maxTroopCount: divideByPrecision(troopConfig?.max_troop_count ?? 0),
          pillageHealthDivisor: troopConfig?.pillage_health_divisor ?? 0,
          baseArmyNumberForStructure: troopConfig?.army_free_per_structure ?? 0,
          armyExtraPerMilitaryBuilding: troopConfig?.army_extra_per_building ?? 0,
          maxArmiesPerStructure: troopConfig?.army_max_per_structure ?? 0,
          battleLeaveSlashNum: troopConfig?.battle_leave_slash_num ?? 0,
          battleLeaveSlashDenom: troopConfig?.battle_leave_slash_denom ?? 0,
          battleTimeScale: troopConfig?.battle_time_scale ?? 0,
        };
      },
      {
        health: 0,
        knightStrength: 0,
        paladinStrength: 0,
        crossbowmanStrength: 0,
        advantagePercent: 0,
        disadvantagePercent: 0,
        maxTroopCount: 0,
        pillageHealthDivisor: 0,
        baseArmyNumberForStructure: 0,
        armyExtraPerMilitaryBuilding: 0,
        maxArmiesPerStructure: 0,
        battleLeaveSlashNum: 0,
        battleLeaveSlashDenom: 0,
        battleTimeScale: 0,
      },
    );
  }

  getBattleGraceTickCount(category: StructureType) {
    return this.getValueOrDefault(() => {
      const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
      switch (category) {
        case StructureType.Hyperstructure:
          return Number(battleConfig?.hyperstructure_immunity_ticks ?? 0);
        case StructureType.FragmentMine:
          return 0;
        default:
          return Number(battleConfig?.regular_immunity_ticks ?? 0);
      }
    }, 0);
  }

  getBattleDelay() {
    return this.getValueOrDefault(() => {
      const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

      return Number(battleConfig?.battle_delay_seconds ?? 0);
    }, 0);
  }

  getResourceBridgeFeeSplitConfig() {
    return this.getValueOrDefault(
      () => {
        const resourceBridgeFeeSplitConfig = getComponentValue(
          this.components.ResourceBridgeFeeSplitConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        );
        return {
          config_id: Number(resourceBridgeFeeSplitConfig?.config_id ?? WORLD_CONFIG_ID),
          velords_fee_on_dpt_percent: Number(resourceBridgeFeeSplitConfig?.velords_fee_on_dpt_percent ?? 0),
          velords_fee_on_wtdr_percent: Number(resourceBridgeFeeSplitConfig?.velords_fee_on_wtdr_percent ?? 0),
          season_pool_fee_on_dpt_percent: Number(resourceBridgeFeeSplitConfig?.season_pool_fee_on_dpt_percent ?? 0),
          season_pool_fee_on_wtdr_percent: Number(resourceBridgeFeeSplitConfig?.season_pool_fee_on_wtdr_percent ?? 0),
          client_fee_on_dpt_percent: Number(resourceBridgeFeeSplitConfig?.client_fee_on_dpt_percent ?? 0),
          client_fee_on_wtdr_percent: Number(resourceBridgeFeeSplitConfig?.client_fee_on_wtdr_percent ?? 0),
          velords_fee_recipient: resourceBridgeFeeSplitConfig?.velords_fee_recipient ?? BigInt(0),
          season_pool_fee_recipient: resourceBridgeFeeSplitConfig?.season_pool_fee_recipient ?? BigInt(0),
          max_bank_fee_dpt_percent: Number(resourceBridgeFeeSplitConfig?.max_bank_fee_dpt_percent ?? 0),
          max_bank_fee_wtdr_percent: Number(resourceBridgeFeeSplitConfig?.max_bank_fee_wtdr_percent ?? 0),
        };
      },
      {
        config_id: Number(WORLD_CONFIG_ID),
        velords_fee_on_dpt_percent: 0,
        velords_fee_on_wtdr_percent: 0,
        season_pool_fee_on_dpt_percent: 0,
        season_pool_fee_on_wtdr_percent: 0,
        client_fee_on_dpt_percent: 0,
        client_fee_on_wtdr_percent: 0,
        velords_fee_recipient: BigInt(0),
        season_pool_fee_recipient: BigInt(0),
        max_bank_fee_dpt_percent: 0,
        max_bank_fee_wtdr_percent: 0,
      },
    );
  }

  getTick(tickId: TickIds) {
    return this.getValueOrDefault(() => {
      const tickConfig = getComponentValue(
        this.components.TickConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(tickId)]),
      );

      return Number(tickConfig?.tick_interval_in_seconds ?? 0);
    }, 0);
  }

  getBankConfig() {
    return this.getValueOrDefault(
      () => {
        const bankConfig = getComponentValue(this.components.BankConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

        return {
          lordsCost: divideByPrecision(Number(bankConfig?.lords_cost)),
          lpFeesNumerator: Number(bankConfig?.lp_fee_num ?? 0),
          lpFeesDenominator: Number(bankConfig?.lp_fee_denom ?? 0),
        };
      },
      {
        lordsCost: 0,
        lpFeesNumerator: 0,
        lpFeesDenominator: 0,
      },
    );
  }

  getAdminBankOwnerFee() {
    const adminBank = getComponentValue(this.components.Bank, getEntityIdFromKeys([ADMIN_BANK_ENTITY_ID]));

    const numerator = Number(adminBank?.owner_fee_num) ?? 0;
    const denominator = Number(adminBank?.owner_fee_denom) ?? 0;
    return numerator / denominator;
  }

  getAdminBankLpFee() {
    const bankConfig = this.getBankConfig();

    return bankConfig.lpFeesNumerator / bankConfig.lpFeesDenominator;
  }

  getCapacityConfig(category: CapacityConfigCategory) {
    return this.getValueOrDefault(() => {
      const capacityConfig = getComponentValue(this.components.CapacityConfig, getEntityIdFromKeys([BigInt(category)]));
      return Number(capacityConfig?.weight_gram ?? 0);
    }, 0);
  }

  getSpeedConfig(entityType: number): number {
    return this.getValueOrDefault(() => {
      const speedConfig = getComponentValue(
        this.components.SpeedConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(entityType)]),
      );

      return speedConfig?.sec_per_km ?? 0;
    }, 0);
  }

  getBuildingPopConfig(buildingId: BuildingType): {
    population: number;
    capacity: number;
  } {
    return this.getValueOrDefault(
      () => {
        const buildingConfig = getComponentValue(
          this.components.BuildingCategoryPopConfig,
          getEntityIdFromKeys([BUILDING_CATEGORY_POPULATION_CONFIG_ID, BigInt(buildingId)]),
        );

        return {
          population: buildingConfig?.population ?? 0,
          capacity: buildingConfig?.capacity ?? 0,
        };
      },
      {
        population: 0,
        capacity: 0,
      },
    );
  }

  getHyperstructureConfig() {
    return this.getValueOrDefault(
      () => {
        const hyperstructureConfig = getComponentValue(
          this.components.HyperstructureConfig,
          getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID]),
        );

        return {
          timeBetweenSharesChange: hyperstructureConfig?.time_between_shares_change ?? 0,
          pointsPerCycle: Number(hyperstructureConfig?.points_per_cycle) ?? 0,
          pointsForWin: Number(hyperstructureConfig?.points_for_win) ?? 0,
          pointsOnCompletion: Number(hyperstructureConfig?.points_on_completion) ?? 0,
        };
      },
      {
        timeBetweenSharesChange: 0,
        pointsPerCycle: 0,
        pointsForWin: 0,
        pointsOnCompletion: 0,
      },
    );
  }

  getHyperstructureTotalContributableAmount(hyperstructureId: number) {
    const requiredAmounts = this.getHyperstructureRequiredAmounts(hyperstructureId);
    return requiredAmounts.reduce(
      (total, { amount, resource }) => total + amount * configManager.getResourceRarity(resource),
      0,
    );
  }

  getHyperstructureRequiredAmounts(hyperstructureId: number) {
    const hyperstructure = getComponentValue(
      this.components.Hyperstructure,
      getEntityIdFromKeys([BigInt(hyperstructureId)]),
    );

    const randomness = BigInt(hyperstructure?.randomness ?? 0);
    const requiredAmounts: { resource: ResourcesIds; amount: number }[] = [];

    // Get amounts for each tier
    for (const tier in ResourceTier) {
      if (isNaN(Number(tier))) continue; // Skip non-numeric enum values

      const resourceTierNumber = Number(tier) as ResourceTier;
      const resourcesInTier = GET_HYPERSTRUCTURE_RESOURCES_PER_TIER(resourceTierNumber, true);
      const amountForTier = this.getHyperstructureRequiredAmountPerTier(resourceTierNumber, randomness);

      // Add entry for each resource in this tier
      resourcesInTier.forEach((resourceId) => {
        requiredAmounts.push({
          resource: resourceId,
          amount: amountForTier,
        });
      });
    }

    return requiredAmounts;
  }

  getHyperstructureRequiredAmountPerTier(resourceTier: ResourceTier, randomness: bigint): number {
    const hyperstructureResourceConfig = getComponentValue(
      this.components.HyperstructureResourceConfig,
      getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, BigInt(resourceTier)]),
    );

    if (!hyperstructureResourceConfig) {
      return 0;
    }

    const minAmount = Number(hyperstructureResourceConfig.min_amount);
    const maxAmount = Number(hyperstructureResourceConfig.max_amount);

    if (minAmount === maxAmount) {
      return divideByPrecision(minAmount);
    }

    const additionalAmount = Number(randomness % BigInt(maxAmount - minAmount));
    return divideByPrecision(minAmount + Number(additionalAmount));
  }

  getBasePopulationCapacity(): number {
    return this.getValueOrDefault(() => {
      return (
        getComponentValue(this.components.PopulationConfig, getEntityIdFromKeys([POPULATION_CONFIG_ID]))
          ?.base_population ?? 0
      );
    }, 0);
  }

  getResourceOutputs(resourceType: number): number {
    return this.getValueOrDefault(() => {
      const productionConfig = getComponentValue(
        this.components.ProductionConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );

      return Number(productionConfig?.amount ?? 0);
    }, 0);
  }

  getTravelFoodCostConfig(troopType: number) {
    return this.getValueOrDefault(
      () => {
        const travelFoodCostConfig = getComponentValue(
          this.components.TravelFoodCostConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(troopType)]),
        );

        return {
          exploreWheatBurnAmount: Number(travelFoodCostConfig?.explore_wheat_burn_amount) ?? 0,
          exploreFishBurnAmount: Number(travelFoodCostConfig?.explore_fish_burn_amount) ?? 0,
          travelWheatBurnAmount: Number(travelFoodCostConfig?.travel_wheat_burn_amount) ?? 0,
          travelFishBurnAmount: Number(travelFoodCostConfig?.travel_fish_burn_amount) ?? 0,
        };
      },
      {
        exploreWheatBurnAmount: 0,
        exploreFishBurnAmount: 0,
        travelWheatBurnAmount: 0,
        travelFishBurnAmount: 0,
      },
    );
  }

  getTroopStaminaConfig(troopId: number) {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.StaminaConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(troopId)]),
      );
      return staminaConfig?.max_stamina ?? 0;
    }, 0);
  }

  getResourceRarity(resourceId: ResourcesIds) {
    return EternumGlobalConfig.resources.resourceRarity[resourceId] ?? 0;
  }

  getResourcePrecision() {
    return EternumGlobalConfig.resources.resourcePrecision;
  }

  getResourceMultiplier() {
    return EternumGlobalConfig.resources.resourceMultiplier;
  }

  getResourceBuildingProduced(buildingType: BuildingType) {
    return EternumGlobalConfig.buildings.buildingResourceProduced[buildingType] ?? 0;
  }

  getBuildingBaseCostPercentIncrease() {
    return this.getValueOrDefault(() => {
      const buildingGeneralConfig = getComponentValue(
        this.components.BuildingGeneralConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      );
      return buildingGeneralConfig?.base_cost_percent_increase ?? 0;
    }, 0);
  }

  getSeasonBridgeConfig() {
    return this.getValueOrDefault(
      () => {
        const seasonBridgeConfig = getComponentValue(
          this.components.SeasonBridgeConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        );
        return {
          closeAfterEndSeconds: seasonBridgeConfig?.close_after_end_seconds ?? 0n,
        };
      },
      {
        closeAfterEndSeconds: 0n,
      },
    );
  }

  getSeasonConfig() {
    return this.getValueOrDefault(
      () => {
        const season = getComponentValue(this.components.Season, getEntityIdFromKeys([WORLD_CONFIG_ID]));
        return {
          startAt: season?.start_at,
          isOver: season?.is_over,
          endedAt: season?.ended_at,
        };
      },
      {
        startAt: 0n,
        isOver: true,
        endedAt: 0n,
      },
    );
  }
}
