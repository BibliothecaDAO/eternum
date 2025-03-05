import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  BuildingType,
  CapacityConfig,
  GET_HYPERSTRUCTURE_RESOURCES_PER_TIER,
  HYPERSTRUCTURE_CONFIG_ID,
  RESOURCE_PRECISION,
  ResourcesIds,
  ResourceTier,
  StructureType,
  WORLD_CONFIG_ID,
} from "../constants";
import { ContractComponents } from "../dojo/contract-components";
import { Config, EntityType, TickIds, TroopType } from "../types";

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private components!: ContractComponents;
  private config!: Config;
  resourceInputs: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  resourceOutput: Record<number, { resource: ResourcesIds; amount: number }> = {};
  resourceLaborOutput: Record<
    number,
    {
      resource_rarity: number;
      depreciation_percent_num: number;
      depreciation_percent_denom: number;
      wheat_burn_per_labor: number;
      fish_burn_per_labor: number;
    }
  > = {};
  hyperstructureTotalCosts: Record<number, { resource: ResourceTier; min_amount: number; max_amount: number }> = {};
  realmUpgradeCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  buildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  resourceBuildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  structureCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};

  public setDojo(components: ContractComponents, config: Config) {
    this.components = components;
    this.config = config;

    this.initializeResourceInputs();
    this.initializeResourceOutput();
    this.initializeResourceLaborOutput();
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

  public getConfig() {
    return this.config;
  }

  private getValueOrDefault<T>(callback: () => T, defaultValue: T): T {
    if (!this.components) {
      return defaultValue;
    }
    return callback();
  }

  private initializeResourceInputs() {
    // if (!this.components) return;

    // for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
    //   const productionConfig = getComponentValue(
    //     this.components.ProductionConfig,
    //     getEntityIdFromKeys([BigInt(resourceType)]),
    //   );

    //   const inputCount = productionConfig?.input_count ?? 0;
    //   const inputs: { resource: ResourcesIds; amount: number }[] = [];

    //   for (let index = 0; index < inputCount; index++) {
    //     const productionInput = getComponentValue(
    //       this.components.ProductionInput,
    //       getEntityIdFromKeys([BigInt(resourceType), BigInt(index)]),
    //     );

    //     if (productionInput) {
    //       const resource = productionInput.input_resource_type;
    //       const amount = this.divideByPrecision(Number(productionInput.input_resource_amount));
    //       inputs.push({ resource, amount });
    //     }
    //   }

    //   this.resourceInputs[Number(resourceType)] = inputs;
    // }
    this.resourceInputs = Object.entries(this.config.resources.resourceInputs).reduce(
      (acc, [key, inputs]) => {
        acc[Number(key)] = inputs.map((input: { resource: number; amount: number }) => ({
          resource: input.resource,
          amount: input.amount,
        }));
        return acc;
      },
      {} as typeof this.config.resources.resourceInputs,
    );
  }

  // todo: need to get directly from chain
  private initializeResourceOutput() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const resourceOutput = this.config.resources.resourceOutputs[Number(resourceType)];

      this.resourceOutput[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        amount: resourceOutput,
      };
    }
  }

  private initializeResourceLaborOutput() {
    this.resourceLaborOutput = Object.fromEntries(
      Object.entries(this.config.resources.resourceProductionByLaborParams)
        .filter(([key, value]) => value.resource_rarity > 0)
        .map(([key, value]) => [Number(key), value]),
    );
  }

  private initializeHyperstructureTotalCosts() {
    const hyperstructureTotalCosts: { resource: ResourceTier; min_amount: number; max_amount: number }[] = [];

    for (const resourceTier of Object.values(ResourceTier).filter(Number.isInteger)) {
      const hyperstructureResourceConfig = getComponentValue(
        this.components.HyperstructureResourceConfig,
        getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, BigInt(resourceTier)]),
      );

      const min_amount = Number(hyperstructureResourceConfig?.min_amount ?? 0) / RESOURCE_PRECISION;

      const max_amount = Number(hyperstructureResourceConfig?.max_amount ?? 0) / RESOURCE_PRECISION;

      hyperstructureTotalCosts.push({ resource: resourceTier as ResourceTier, min_amount, max_amount });
    }

    this.hyperstructureTotalCosts = hyperstructureTotalCosts;
  }

  private initializeRealmUpgradeCosts() {
    this.realmUpgradeCosts = Object.fromEntries(
      Object.entries(this.config.realmUpgradeCosts).map(([key, costs]) => [
        key,
        costs.map((cost: any) => ({ ...cost, amount: cost.amount })),
      ]),
    );
  }

  private initializeResourceBuildingCosts() {
    this.resourceBuildingCosts = Object.fromEntries(
      Object.entries(this.config.buildings.resourceBuildingCosts).map(([key, costs]) => [
        key,
        costs.map((cost: any) => ({ ...cost, amount: cost.amount })),
      ]),
    );
  }

  private initializeBuildingCosts() {
    this.buildingCosts = Object.fromEntries(
      Object.entries(this.config.buildings.otherBuildingCosts).map(([key, costs]) => [
        key,
        costs.map((cost: any) => ({ ...cost, amount: cost.amount })),
      ]),
    );
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
      amount: this.divideByPrecision(Number(hyperstructureResourceConfig?.min_amount) ?? 0),
      resource: ResourcesIds.AncientFragment,
    };
  }

  // weight in grams, per actual resource (without precision)
  getResourceWeight(resourceId: number): number {
    return this.getValueOrDefault(() => {
      const weightNanogram = getComponentValue(
        this.components.WeightConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(resourceId)]),
      )?.weight_nanogram;
      return Number(weightNanogram ?? 0);
    }, 0);
  }

  getTravelStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.troop_stamina_config;
      return staminaConfig?.stamina_travel_stamina_cost ?? 0;
    }, 1);
  }

  getExploreStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.troop_stamina_config;
      return staminaConfig?.stamina_explore_stamina_cost ?? 0;
    }, 1);
  }

  getExploreReward() {
    return this.getValueOrDefault(() => {
      const exploreConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.map_config;

      return Number(exploreConfig?.reward_resource_amount ?? 0);
    }, 0);
  }

  getTroopConfig() {
    // Default config structure matching the expected types
    const defaultTroopConfig = {
      troop_damage_config: {
        damage_biome_bonus_num: 0,
        damage_beta_small: 0n,
        damage_beta_large: 0n,
        damage_scaling_factor: 0n,
        damage_c0: 0n,
        damage_delta: 0n,
        t1_damage_value: 0n,
        t2_damage_multiplier: 0n,
        t3_damage_multiplier: 0n,
      },

      troop_limit_config: {
        explorer_max_party_count: 0,
        explorer_guard_max_troop_count: 0,
        guard_resurrection_delay: 0,
        mercenaries_troop_lower_bound: 0,
        mercenaries_troop_upper_bound: 0,
        troops_per_military_building: 0,
        max_defense_armies: 0,
      },

      troop_stamina_config: {
        stamina_gain_per_tick: 0,
        stamina_initial: 0,
        stamina_bonus_value: 0,
        stamina_knight_max: 0,
        stamina_paladin_max: 0,
        stamina_crossbowman_max: 0,
        stamina_attack_req: 0,
        stamina_attack_max: 0,
        stamina_explore_wheat_cost: 0,
        stamina_explore_fish_cost: 0,
        stamina_explore_stamina_cost: 0,
        stamina_travel_wheat_cost: 0,
        stamina_travel_fish_cost: 0,
        stamina_travel_stamina_cost: 0,
      },
    };

    return this.getValueOrDefault(() => {
      // todo: need to fix this
      const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

      if (!worldConfig) return defaultTroopConfig;

      const { troop_damage_config, troop_limit_config, troop_stamina_config } = worldConfig;

      return {
        troop_damage_config,
        troop_limit_config: {
          ...troop_limit_config,
          troops_per_military_building: 1,
          max_defense_armies: 4,
        },
        troop_stamina_config,
      };
    }, defaultTroopConfig);
  }

  getCombatConfig() {
    return this.getValueOrDefault(
      () => {
        const combatConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.troop_damage_config;

        const troopStaminaConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.troop_stamina_config;

        return {
          stamina_bonus_value: troopStaminaConfig?.stamina_bonus_value ?? 0,
          stamina_attack_req: troopStaminaConfig?.stamina_attack_req ?? 0,
          damage_biome_bonus_num: combatConfig?.damage_biome_bonus_num ?? 0,
          damage_beta_small: combatConfig?.damage_beta_small ?? 0n,
          damage_beta_large: combatConfig?.damage_beta_large ?? 0n,
          damage_scaling_factor: combatConfig?.damage_scaling_factor ?? 0n,
          damage_c0: combatConfig?.damage_c0 ?? 0n,
          damage_delta: combatConfig?.damage_delta ?? 0n,
          t1_damage_value: combatConfig?.t1_damage_value ?? 0n,
          t2_damage_multiplier: combatConfig?.t2_damage_multiplier ?? 0n,
          t3_damage_multiplier: combatConfig?.t3_damage_multiplier ?? 0n,
        };
      },
      {
        stamina_bonus_value: 0,
        stamina_attack_req: 0,
        damage_biome_bonus_num: 0,
        damage_beta_small: 0n,
        damage_beta_large: 0n,
        damage_scaling_factor: 0n,
        damage_c0: 0n,
        damage_delta: 0n,
        t1_damage_value: 0n,
        t2_damage_multiplier: 0n,
        t3_damage_multiplier: 0n,
      },
    );
  }

  getBattleGraceTickCount(category: StructureType) {
    return this.getValueOrDefault(() => {
      const battleConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.battle_config;
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

  getMinTravelStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.troop_stamina_config;
      return staminaConfig?.stamina_travel_stamina_cost ?? 0;
    }, 1);
  }

  getResourceBridgeFeeSplitConfig() {
    return this.getValueOrDefault(
      () => {
        const resourceBridgeFeeSplitConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.res_bridge_fee_split_config;
        return {
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
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.tick_config;

      if (tickId === TickIds.Armies) {
        return Number(tickConfig?.armies_tick_in_seconds ?? 0);
      } else if (tickId === TickIds.Default) {
        return 1;
      } else {
        throw new Error("Undefined tick id in getTick");
      }
    }, 0);
  }

  getBankConfig() {
    return this.getValueOrDefault(
      () => {
        const bankConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.bank_config;

        return {
          lpFeesNumerator: Number(bankConfig?.lp_fee_num ?? 0),
          lpFeesDenominator: Number(bankConfig?.lp_fee_denom ?? 0),
        };
      },
      {
        lpFeesNumerator: 0,
        lpFeesDenominator: 0,
      },
    );
  }

  getAdminBankOwnerFee() {
    const bankConfig = getComponentValue(
      this.components.WorldConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    )?.bank_config;
    const numerator = Number(bankConfig?.owner_fee_num) ?? 0;
    const denominator = Number(bankConfig?.owner_fee_denom) ?? 0;
    return numerator / denominator;
  }

  getAdminBankLpFee() {
    const bankConfig = this.getBankConfig();

    return bankConfig.lpFeesNumerator / bankConfig.lpFeesDenominator;
  }

  getCapacityConfig(category: CapacityConfig) {
    return this.getValueOrDefault(() => {
      const capacityConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.capacity_config;

      switch (category) {
        case CapacityConfig.Structure:
          return Number(capacityConfig?.structure_capacity ?? 0);
        case CapacityConfig.Donkey:
          return Number(capacityConfig?.donkey_capacity ?? 0);
        case CapacityConfig.Army:
          return Number(capacityConfig?.troop_capacity ?? 0);
        case CapacityConfig.Storehouse:
          return Number(capacityConfig?.storehouse_boost_capacity ?? 0);
        case CapacityConfig.None:
          return 0;
        default:
          throw new Error("Invalid capacity config category");
      }
    }, 0);
  }

  getSpeedConfig(entityType: EntityType): number {
    return this.getValueOrDefault(() => {
      const speedConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.speed_config;

      if (entityType === EntityType.DONKEY) {
        return Number(speedConfig?.donkey_sec_per_km ?? 0);
      } else if (entityType === EntityType.TROOP) {
        return Number(speedConfig?.army_sec_per_km ?? 0);
      } else {
        throw new Error("Undefined entity type in getSpeedConfig");
      }
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
          getEntityIdFromKeys([BigInt(buildingId)]),
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
  getBuildingGeneralConfig() {
    return this.getValueOrDefault(
      () =>
        getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.building_general_config,
      {
        base_cost_percent_increase: 0,
      },
    );
  }

  getHyperstructureConfig() {
    return this.getValueOrDefault(
      () => {
        const hyperstructureConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID]),
        )?.hyperstructure_config;

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
      (total, { amount, resource }) => total + amount * this.getResourceRarity(resource),
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
      getEntityIdFromKeys([BigInt(resourceTier)]),
    );

    if (!hyperstructureResourceConfig) {
      return 0;
    }

    const minAmount = Number(hyperstructureResourceConfig.min_amount);
    const maxAmount = Number(hyperstructureResourceConfig.max_amount);

    if (minAmount === maxAmount) {
      return this.divideByPrecision(minAmount);
    }

    const additionalAmount = Number(randomness % BigInt(maxAmount - minAmount));
    return this.divideByPrecision(minAmount + Number(additionalAmount));
  }

  getBasePopulationCapacity(): number {
    return this.getValueOrDefault(() => {
      return (
        getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.population_config
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

      return Number(productionConfig?.amount_per_building_per_tick ?? 0);
    }, 0);
  }

  getTravelFoodCostConfig(troopType: number) {
    return this.getValueOrDefault(
      () => {
        const travelFoodCostConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.troop_stamina_config;

        return {
          exploreWheatBurnAmount: Number(travelFoodCostConfig?.stamina_explore_wheat_cost) ?? 0,
          exploreFishBurnAmount: Number(travelFoodCostConfig?.stamina_explore_fish_cost) ?? 0,
          travelWheatBurnAmount: Number(travelFoodCostConfig?.stamina_travel_wheat_cost) ?? 0,
          travelFishBurnAmount: Number(travelFoodCostConfig?.stamina_travel_fish_cost) ?? 0,
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

  getStaminaCombatConfig() {
    return {
      staminaCost: 30,
      staminaBonus: 30,
    };
  }

  getTroopStaminaConfig(troopType: TroopType) {
    return this.getValueOrDefault(
      () => {
        const staminaConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.troop_stamina_config;

        switch (troopType) {
          case TroopType.Knight:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: staminaConfig?.stamina_knight_max ?? 0,
            };
          case TroopType.Crossbowman:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: staminaConfig?.stamina_crossbowman_max ?? 0,
            };
          case TroopType.Paladin:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: staminaConfig?.stamina_paladin_max ?? 0,
            };
          default:
            return {
              staminaInitial: 0,
              staminaMax: 0,
            };
        }
      },
      {
        staminaInitial: 0,
        staminaMax: 0,
      },
    );
  }

  getResourceRarity(resourceId: ResourcesIds) {
    return this.config.resources.resourceRarity[resourceId] ?? 0;
  }

  getResourcePrecision() {
    return RESOURCE_PRECISION;
  }

  divideByPrecision(value: number) {
    return value / RESOURCE_PRECISION;
  }

  getResourceMultiplier() {
    return this.config.resources.resourceMultiplier;
  }

  getResourceBuildingProduced(buildingType: BuildingType) {
    return this.config.buildings.buildingResourceProduced[buildingType] ?? 0;
  }

  getBuildingBaseCostPercentIncrease() {
    return this.getValueOrDefault(() => {
      const buildingGeneralConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.building_general_config;
      return buildingGeneralConfig?.base_cost_percent_increase ?? 0;
    }, 0);
  }

  getSeasonBridgeConfig() {
    return this.getValueOrDefault(
      () => {
        const seasonBridgeConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.season_bridge_config;
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

export const configManager = ClientConfigManager.instance();
