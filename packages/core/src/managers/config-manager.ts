import {
  BiomeType,
  BuildingType,
  CapacityConfig,
  Config,
  ContractComponents,
  EntityType,
  getProducedResource,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TickIds,
  TroopTier,
  TroopType,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/types";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getTotalResourceWeightKg, gramToKg } from "../utils";

type LaborConfig = {
  laborProductionPerResource: number;
  laborBurnPerResourceOutput: number;
  laborRatePerTick: number;
  resourceOutputPerInputResources: number;
  inputResources: { resource: ResourcesIds; amount: number }[];
};

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private components!: ContractComponents;
  private config!: Config;
  buildingOutputs: Record<number, number> = {};
  complexSystemResourceInputs: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  complexSystemResourceOutput: Record<number, { resource: ResourcesIds; amount: number }> = {};
  resourceOutputRate: Record<
    number,
    { resource: ResourcesIds; village_output_per_second: number; realm_output_per_second: number }
  > = {};

  simpleSystemResourceInputs: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  simpleSystemResourceOutput: Record<number, { resource: ResourcesIds; amount: number }> = {};
  laborOutputPerResource: Record<number, { resource: ResourcesIds; amount: number }> = {};

  hyperstructureTotalCosts: { resource: ResourcesIds; min_amount: number; max_amount: number }[] = [];
  realmUpgradeCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  complexBuildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  simpleBuildingCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  structureCosts: Record<number, { resource: ResourcesIds; amount: number }[]> = {};
  resourceWeightsKg: Record<number, number> = {};

  public setDojo(components: ContractComponents, config: Config) {
    this.components = components;
    this.config = config;

    this.initializeResourceProduction();
    this.initializeHyperstructureTotalCosts();
    this.initializeRealmUpgradeCosts();
    this.initializeBuildingCosts();
    this.initializeStructureCosts();
    this.initializeResourceWeights();
  }

  public static instance(): ClientConfigManager {
    if (!ClientConfigManager._instance) {
      ClientConfigManager._instance = new ClientConfigManager();
    }

    return ClientConfigManager._instance;
  }

  private getValueOrDefault<T>(callback: () => T, defaultValue: T): T {
    return callback();
  }

  private initializeResourceWeights() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const weightConfig = getComponentValue(this.components.WeightConfig, getEntityIdFromKeys([BigInt(resourceType)]));
      this.resourceWeightsKg[Number(resourceType)] = gramToKg(Number(weightConfig?.weight_gram ?? 0));
    }
  }

  private initializeResourceProduction() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const productionConfig = getComponentValue(
        this.components.ResourceFactoryConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );

      const complexSystemResourceInputCount = productionConfig?.complex_input_list_count ?? 0;
      const complexSystemResourceInputEntityId = productionConfig?.complex_input_list_id ?? 0;
      const complexSystemResourceInputs: { resource: ResourcesIds; amount: number }[] = [];

      for (let index = 0; index < complexSystemResourceInputCount; index++) {
        const resource = getComponentValue(
          this.components.ResourceList,
          getEntityIdFromKeys([BigInt(complexSystemResourceInputEntityId), BigInt(index)]),
        );

        if (resource) {
          const resource_type = resource.resource_type;
          const amount = this.divideByPrecision(Number(resource.amount));
          complexSystemResourceInputs.push({ resource: resource_type, amount });
        }
      }

      const simpleSystemResourceInputCount = productionConfig?.simple_input_list_count ?? 0;
      const simpleSystemResourceInputEntityId = productionConfig?.simple_input_list_id ?? 0;
      const simpleSystemResourceInputs: { resource: ResourcesIds; amount: number }[] = [];
      for (let index = 0; index < simpleSystemResourceInputCount; index++) {
        const resource = getComponentValue(
          this.components.ResourceList,
          getEntityIdFromKeys([BigInt(simpleSystemResourceInputEntityId), BigInt(index)]),
        );

        if (resource) {
          const resource_type = resource.resource_type;
          const amount = this.divideByPrecision(Number(resource.amount));
          simpleSystemResourceInputs.push({ resource: resource_type, amount });
        }
      }

      this.complexSystemResourceInputs[Number(resourceType)] = complexSystemResourceInputs;
      this.complexSystemResourceOutput[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        amount: this.divideByPrecision(Number(productionConfig?.output_per_complex_input) ?? 0),
      };

      this.simpleSystemResourceInputs[Number(resourceType)] = simpleSystemResourceInputs;
      this.simpleSystemResourceOutput[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        amount: this.divideByPrecision(Number(productionConfig?.output_per_simple_input) ?? 0),
      };

      this.laborOutputPerResource[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        amount: Number(productionConfig?.labor_output_per_resource),
      };

      this.resourceOutputRate[Number(resourceType)] = {
        resource: Number(resourceType) as ResourcesIds,
        realm_output_per_second: Number(productionConfig?.realm_output_per_second),
        village_output_per_second: Number(productionConfig?.village_output_per_second),
      };
    }
  }

  private initializeHyperstructureTotalCosts() {
    const hyperstructureTotalCosts: { resource: ResourcesIds; min_amount: number; max_amount: number }[] = [];

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const hyperstructureResourceConfig = getComponentValue(
        this.components.HyperstructureConstructConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );
      if (!hyperstructureResourceConfig) continue;

      hyperstructureTotalCosts.push({
        resource: resourceType as ResourcesIds,
        min_amount: hyperstructureResourceConfig.min_amount,
        max_amount: hyperstructureResourceConfig.max_amount,
      });
    }

    this.hyperstructureTotalCosts = hyperstructureTotalCosts;
  }

  private initializeRealmUpgradeCosts() {
    const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    const maxLevel = Number(worldConfig?.structure_max_level_config?.realm_max) || 0;

    for (let level = 1; level <= maxLevel; level++) {
      const levelConfig = getComponentValue(this.components.StructureLevelConfig, getEntityIdFromKeys([BigInt(level)]));
      if (levelConfig) {
        const inputs: { resource: ResourcesIds; amount: number }[] = [];
        for (let index = 0; index < levelConfig.required_resource_count; index++) {
          const resource = getComponentValue(
            this.components.ResourceList,
            getEntityIdFromKeys([BigInt(levelConfig.required_resources_id), BigInt(index)]),
          );
          if (resource) {
            inputs.push({
              resource: resource.resource_type as ResourcesIds,
              amount: this.divideByPrecision(Number(resource.amount)),
            });
          }
        }
        this.realmUpgradeCosts[level] = inputs;
      }
    }
  }

  private initializeBuildingCosts() {
    const buildingConfigsEntities = runQuery([Has(this.components.BuildingCategoryConfig)]);

    for (const buildingConfigEntity of buildingConfigsEntities) {
      const buildingConfig = getComponentValue(this.components.BuildingCategoryConfig, buildingConfigEntity);
      if (buildingConfig) {
        // Process complex building costs
        const complexEntityId = buildingConfig.complex_erection_cost_id;
        const complexResourceCount = buildingConfig.complex_erection_cost_count || 0;
        const complexInputs: { resource: ResourcesIds; amount: number }[] = [];

        for (let index = 0; index < complexResourceCount; index++) {
          const resource = getComponentValue(
            this.components.ResourceList,
            getEntityIdFromKeys([BigInt(complexEntityId), BigInt(index)]),
          );

          if (resource) {
            complexInputs.push({
              resource: resource.resource_type as ResourcesIds,
              amount: this.divideByPrecision(Number(resource.amount)),
            });
          }
        }

        this.complexBuildingCosts[Number(buildingConfig.category)] = complexInputs;

        // Process simple building costs
        const simpleEntityId = buildingConfig.simple_erection_cost_id;
        const simpleResourceCount = buildingConfig.simple_erection_cost_count || 0;
        const simpleInputs: { resource: ResourcesIds; amount: number }[] = [];

        for (let index = 0; index < simpleResourceCount; index++) {
          const resource = getComponentValue(
            this.components.ResourceList,
            getEntityIdFromKeys([BigInt(simpleEntityId), BigInt(index)]),
          );

          if (resource) {
            simpleInputs.push({
              resource: resource.resource_type as ResourcesIds,
              amount: this.divideByPrecision(Number(resource.amount)),
            });
          }
        }

        this.simpleBuildingCosts[Number(buildingConfig.category)] = simpleInputs;

        // Set building outputs
        const resourceType = getProducedResource(buildingConfig.category);

        if (resourceType) {
          this.buildingOutputs[Number(buildingConfig.category)] = resourceType;
        }
      }
    }
  }

  private initializeStructureCosts() {
    this.structureCosts[StructureType.Hyperstructure] = [this.getHyperstructureConstructionCosts()];
  }

  public getRefillPerTick() {
    const staminaRefillConfig = getComponentValue(
      this.components.WorldConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    )?.troop_stamina_config;
    return staminaRefillConfig?.stamina_gain_per_tick || 0;
  }

  public getMaxLevel(category: StructureType) {
    const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    if (category === StructureType.Realm) {
      return Number(worldConfig?.structure_max_level_config?.realm_max ?? 0);
    } else if (category === StructureType.Village) {
      return Number(worldConfig?.structure_max_level_config?.village_max ?? 0);
    }
    return 0;
  }

  public getHyperstructureTotalCosts() {
    return this.hyperstructureTotalCosts;
  }

  public getHyperstructureConstructionCosts() {
    const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return {
      amount: this.divideByPrecision(Number(worldConfig?.hyperstructure_config?.initialize_shards_amount) ?? 0),
      resource: ResourcesIds.AncientFragment,
    };
  }

  // weight in grams, per actual resource (without precision)
  getResourceWeightKg(resourceId: number): number {
    return this.resourceWeightsKg[resourceId] || 0;
  }
  getTravelStaminaCost(biome: BiomeType, troopType: TroopType) {
    return this.getValueOrDefault(() => {
      const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
      const baseStaminaCost = worldConfig?.troop_stamina_config?.stamina_travel_stamina_cost || 0;
      const biomeBonus = worldConfig?.troop_stamina_config?.stamina_bonus_value || 0;

      // Biome-specific modifiers per troop type
      switch (biome) {
        case BiomeType.Ocean:
          return baseStaminaCost - biomeBonus; // -10 for all troops
        case BiomeType.DeepOcean:
          return baseStaminaCost - biomeBonus; // -10 for all troops
        case BiomeType.Beach:
          return baseStaminaCost; // No modifier
        case BiomeType.Grassland:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.Shrubland:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.SubtropicalDesert:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.TemperateDesert:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.TropicalRainForest:
          return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.TropicalSeasonalForest:
          return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.TemperateRainForest:
          return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.TemperateDeciduousForest:
          return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.Tundra:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.Taiga:
          return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.Snow:
          return baseStaminaCost + (troopType !== TroopType.Paladin ? biomeBonus : 0);
        case BiomeType.Bare:
          return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
        case BiomeType.Scorched:
          return baseStaminaCost + biomeBonus; // +10 for all troops
        default:
          return baseStaminaCost;
      }
    }, 0);
  }

  public getBiomeCombatBonus(troopType: TroopType, biome: BiomeType): number {
    const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    const biomeBonusNum = worldConfig?.troop_damage_config?.damage_biome_bonus_num || 0;
    const biomeBonus = biomeBonusNum / 10_000;

    const biomeModifiers: Record<BiomeType, Record<TroopType, number>> = {
      [BiomeType.None]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0 },
      [BiomeType.Ocean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.DeepOcean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Beach]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Grassland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.Shrubland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.SubtropicalDesert]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.TemperateDesert]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.TropicalRainForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TropicalSeasonalForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TemperateRainForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TemperateDeciduousForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Tundra]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.Taiga]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Snow]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Bare]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      // add 30% damage to all troops
      [BiomeType.Scorched]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
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

  getSeasonMainGameStartAt() {
    return this.getValueOrDefault(() => {
      const startMainAt = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))
        ?.season_config.start_main_at;

      return startMainAt;
    }, 0);
  }

  getExploreReward() {
    return this.getValueOrDefault(
      () => {
        const exploreConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.map_config;

        const blitzModeOn = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.blitz_mode_on;

        let reward_resource = ResourcesIds.AncientFragment;
        if (blitzModeOn) {
          reward_resource = ResourcesIds.Essence;
        }
        let resource_amount = Number(exploreConfig?.reward_resource_amount ?? 0);
        let resource_weight = getTotalResourceWeightKg([{ resourceId: reward_resource, amount: resource_amount }]);

        return { reward_resource, resource_amount, resource_weight };
      },
      { reward_resource: ResourcesIds.AncientFragment, resource_amount: 0, resource_weight: 0 },
    );
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
          stamina_attack_max: troopStaminaConfig?.stamina_attack_max ?? 0,
          damage_biome_bonus_num: combatConfig?.damage_biome_bonus_num ?? 0,
          damage_raid_percent_num: combatConfig?.damage_raid_percent_num ?? 0,
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
        stamina_attack_max: 0,
        damage_biome_bonus_num: 0,
        damage_raid_percent_num: 0,
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

  getBattleGraceTickCount() {
    return this.getValueOrDefault(() => {
      const battleConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.battle_config;
      return Number(battleConfig?.regular_immunity_ticks ?? 0);
    }, 0);
  }

  getMinTravelStaminaCost() {
    return this.getValueOrDefault(() => {
      const staminaConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.troop_stamina_config;
      const baseTravelCost = staminaConfig?.stamina_travel_stamina_cost ?? 0;
      const biomeBonus = staminaConfig?.stamina_bonus_value ?? 0;
      return Math.max(baseTravelCost - biomeBonus, 10);
    }, 10);
  }

  getWorldStructureDefenseSlotsConfig() {
    return {
      [StructureType.FragmentMine]: 1,
      [StructureType.Hyperstructure]: 4,
      [StructureType.Bank]: 4,
    };
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
          realm_fee_dpt_percent: Number(resourceBridgeFeeSplitConfig?.realm_fee_dpt_percent ?? 0),
          realm_fee_wtdr_percent: Number(resourceBridgeFeeSplitConfig?.realm_fee_wtdr_percent ?? 0),
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
        realm_fee_dpt_percent: 0,
        realm_fee_wtdr_percent: 0,
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
      } else if (tickId === TickIds.Delivery) {
        return Number(tickConfig?.delivery_tick_in_seconds ?? 0);
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

  getCapacityConfigKg(category: CapacityConfig) {
    return this.getValueOrDefault(() => {
      const nonStructureCapacityConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.capacity_config;

      const structureCapacityConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.structure_capacity_config;

      let capacityInGrams = 0;
      switch (category) {
        case CapacityConfig.RealmStructure:
          capacityInGrams = Number(structureCapacityConfig?.realm_capacity ?? 0);
          break;
        case CapacityConfig.VillageStructure:
          capacityInGrams = Number(structureCapacityConfig?.village_capacity ?? 0);
          break;
        case CapacityConfig.HyperstructureStructure:
          capacityInGrams = Number(structureCapacityConfig?.hyperstructure_capacity ?? 0);
          break;
        case CapacityConfig.FragmentMineStructure:
          capacityInGrams = Number(structureCapacityConfig?.fragment_mine_capacity ?? 0);
          break;
        case CapacityConfig.BankStructure:
          capacityInGrams = Number(structureCapacityConfig?.bank_structure_capacity ?? 0);
          break;
        case CapacityConfig.Donkey:
          capacityInGrams = Number(nonStructureCapacityConfig?.donkey_capacity ?? 0);
          break;
        case CapacityConfig.Army:
          capacityInGrams = Number(nonStructureCapacityConfig?.troop_capacity ?? 0);
          break;
        case CapacityConfig.Storehouse:
          capacityInGrams = Number(nonStructureCapacityConfig?.storehouse_boost_capacity ?? 0);
          break;
        case CapacityConfig.None:
          return 0;
        default:
          throw new Error("Invalid capacity config category");
      }

      // Convert from grams to kg by dividing by 1000
      return gramToKg(capacityInGrams);
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
      } else {
        throw new Error("Undefined entity type in getSpeedConfig");
      }
    }, 0);
  }

  getBuildingConfig() {
    return this.getValueOrDefault(
      () => getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.building_config,
      {
        base_population: 0,
        base_cost_percent_increase: 0,
      },
    );
  }

  getBlitzConfig() {
    return this.getValueOrDefault(
      () => {
        const config = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
        if (!config) return;

        const blitzSettlementConfig = config.blitz_settlement_config;
        const blitzRegistrationConfig = config.blitz_registration_config;

        return {
          blitz_mode_on: config?.blitz_mode_on ?? false,
          blitz_settlement_config: {
            base_distance: Number(blitzSettlementConfig.base_distance),
            side: Number(blitzSettlementConfig.side),
            step: Number(blitzSettlementConfig.step),
            point: Number(blitzSettlementConfig.point),
          },
          blitz_registration_config: {
            fee_amount: BigInt(blitzRegistrationConfig.fee_amount),
            fee_token: BigInt(blitzRegistrationConfig.fee_token),
            fee_recipient: BigInt(blitzRegistrationConfig.fee_recipient),
            registration_count: Number(blitzRegistrationConfig.registration_count),
            registration_count_max: Number(blitzRegistrationConfig.registration_count_max),
            registration_start_at: Number(blitzRegistrationConfig.registration_start_at),
            registration_end_at: Number(blitzRegistrationConfig.registration_end_at),
            creation_start_at: Number(blitzRegistrationConfig.creation_start_at),
            creation_end_at: Number(blitzRegistrationConfig.creation_end_at),
            assigned_positions_count: Number(blitzRegistrationConfig.assigned_positions_count),
          },
        };
      },
      {
        blitz_mode_on: false,
        blitz_settlement_config: {
          base_distance: 0,
          side: 0,
          step: 0,
          point: 0,
        },
        blitz_registration_config: {
          fee_amount: BigInt(0),
          fee_token: BigInt(0),
          fee_recipient: BigInt(0),
          registration_count: 0,
          registration_count_max: 0,
          registration_start_at: 0,
          registration_end_at: 0,
          creation_start_at: 0,
          creation_end_at: 0,
          assigned_positions_count: 0,
        },
      },
    );
  }

  getHyperstructureConfig() {
    return this.getValueOrDefault(
      () => {
        const victoryPointsGrantConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.victory_points_grant_config;

        const victoryPointsWinConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.victory_points_win_config;

        return {
          // todo: need to fix this
          timeBetweenSharesChange: 0,
          pointsPerCycle: (Number(victoryPointsGrantConfig?.hyp_points_per_second) ?? 0) / 1_000_000,
          pointsForWin: (Number(victoryPointsWinConfig?.points_for_win) ?? 0) / 1_000_000,
        };
      },
      {
        timeBetweenSharesChange: 0,
        pointsPerCycle: 0,
        pointsForWin: 0,
      },
    );
  }

  getBasePopulationCapacity(): number {
    return this.getValueOrDefault(() => {
      return (
        getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.building_config
          ?.base_population ?? 0
      );
    }, 0);
  }

  getBuildingCategoryConfig(buildingType: BuildingType) {
    return this.getValueOrDefault(
      () => {
        const buildingCategoryConfig = getComponentValue(
          this.components.BuildingCategoryConfig,
          getEntityIdFromKeys([BigInt(buildingType)]),
        );
        return {
          population_cost: buildingCategoryConfig?.population_cost ?? 0,
          capacity_grant: buildingCategoryConfig?.capacity_grant ?? 0,
        };
      },
      {
        population_cost: 0,
        capacity_grant: 0,
      },
    );
  }

  getResourceOutputs(resourceType: number): number {
    return this.getValueOrDefault(() => {
      const productionConfig = getComponentValue(
        this.components.ResourceFactoryConfig,
        getEntityIdFromKeys([BigInt(resourceType)]),
      );

      return Number(productionConfig?.realm_output_per_second ?? 0);
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

  getTroopStaminaConfig(troopType: TroopType, troopTier: TroopTier) {
    return this.getValueOrDefault(
      () => {
        const staminaConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.troop_stamina_config;

        let tierBonus = 0;
        if (troopTier === TroopTier.T2) {
          tierBonus = 20;
        } else if (troopTier === TroopTier.T3) {
          tierBonus = 40;
        }

        switch (troopType) {
          case TroopType.Knight:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: (staminaConfig?.stamina_knight_max ?? 0) + tierBonus,
            };
          case TroopType.Crossbowman:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: (staminaConfig?.stamina_crossbowman_max ?? 0) + tierBonus,
            };
          case TroopType.Paladin:
            return {
              staminaInitial: staminaConfig?.stamina_initial ?? 0,
              staminaMax: (staminaConfig?.stamina_paladin_max ?? 0) + tierBonus,
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

  // TODO: don't use config but get from chain directly
  // but only way is through get_contributable_resources_with_rarity
  getResourceRarity(resourceId: ResourcesIds) {
    return this.config.resources.resourceRarity[resourceId] ?? 0;
  }

  getResourcePrecision() {
    return RESOURCE_PRECISION;
  }

  divideByPrecision(value: number) {
    return value / RESOURCE_PRECISION;
  }

  getResourceBuildingProduced(buildingType: BuildingType) {
    return this.buildingOutputs[Number(buildingType)];
  }

  getBuildingBaseCostPercentIncrease() {
    return this.getValueOrDefault(() => {
      const buildingGeneralConfig = getComponentValue(
        this.components.WorldConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID]),
      )?.building_config;
      return buildingGeneralConfig?.base_cost_percent_increase ?? 0;
    }, 0);
  }

  getSeasonConfig() {
    return this.getValueOrDefault(
      () => {
        const seasonConfig = getComponentValue(
          this.components.WorldConfig,
          getEntityIdFromKeys([WORLD_CONFIG_ID]),
        )?.season_config;
        return {
          startSettlingAt: seasonConfig?.start_settling_at ?? 0,
          startMainAt: seasonConfig?.start_main_at ?? 0,
          endAt: seasonConfig?.end_at ?? 0,
          bridgeCloseAfterEndSeconds: seasonConfig?.end_grace_seconds ?? 0,
        };
      },
      {
        startSettlingAt: 0,
        startMainAt: 0,
        endAt: 0,
        bridgeCloseAfterEndSeconds: 0,
      },
    );
  }

  public getLaborConfig = (resourceId: number): LaborConfig | undefined => {
    const laborProducedPerResource =
      configManager.laborOutputPerResource[resourceId as keyof typeof configManager.laborOutputPerResource];
    const laborResourceOutput =
      configManager.resourceOutputRate[ResourcesIds.Labor as keyof typeof configManager.resourceOutputRate];
    const simpleSystemResourceInputs =
      configManager.simpleSystemResourceInputs[resourceId as keyof typeof configManager.simpleSystemResourceInputs];
    const laborBurnPerResourceOutput = simpleSystemResourceInputs.filter(
      (x) => x.resource == ResourcesIds.Labor,
    )[0] || { resource: resourceId, amount: 0 };
    const simpleSystemResourceOutput = configManager.simpleSystemResourceOutput[
      resourceId as keyof typeof configManager.simpleSystemResourceOutput
    ] || { resource: resourceId, amount: 0 };

    return {
      laborProductionPerResource: this.divideByPrecision(laborProducedPerResource.amount),
      laborBurnPerResourceOutput: laborBurnPerResourceOutput.amount,
      laborRatePerTick: this.divideByPrecision(laborResourceOutput.realm_output_per_second),
      inputResources: simpleSystemResourceInputs,
      resourceOutputPerInputResources: simpleSystemResourceOutput.amount,
    };
  };

  getWonderBonusConfig = () => {
    return this.getValueOrDefault(
      () => {
        const worldConfig = getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
        if (!worldConfig) return { withinTileDistance: 0, bonusPercentNum: 0 };

        const wonderBonusConfig = (worldConfig as any).wonder_production_bonus_config;
        return {
          withinTileDistance: Number(wonderBonusConfig?.within_tile_distance ?? 0),
          bonusPercentNum: Number(wonderBonusConfig?.bonus_percent_num ?? 0),
        };
      },
      {
        withinTileDistance: 0,
        bonusPercentNum: 0,
      },
    );
  };

  isLaborProductionEnabled() {
    return this.getValueOrDefault(() => {
      return Object.values(configManager.laborOutputPerResource).some((x) => x.amount > 0);
    }, false);
  }
}

export const configManager = ClientConfigManager.instance();
