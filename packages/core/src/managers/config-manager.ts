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
import { getEntityIdFromKeys } from "./game-entity-keys";
import { disposeActiveGameSyncRuntime } from "../sync/game-sync-runtime";
import { Biome, BiomeClimateConfig, NEUTRAL_BIOME_CLIMATE } from "../utils/biome";
import { setGameEntityKeyGameId } from "./game-entity-keys";
import { getTotalResourceWeightKg, gramToKg } from "../utils";

const MAP_CENTER = 2147483646;

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
  mapCenter: number = MAP_CENTER;

  // s2 single-world game scope. 0 = legacy single-game world (s1) where the
  // per-game row is keyed by WORLD_CONFIG_ID and rulebook members lived inline.
  private gameId = 0;
  private presetId = 0;

  // Guardrail #2 (AGENTS.md "No silent defaults"): before the initial config
  // sync lands, keyed lookups legitimately miss while data streams in; after
  // it, an empty lookup is a real bug (wrong key shape, missing preset row).
  private configSynced = false;
  private warnedConfigMissSites = new Set<string>();

  /** Must be called before setDojo on the s2 arm so cost snapshots read the right preset. */
  public setActiveGame(gameId: number, presetId: number) {
    disposeActiveGameSyncRuntime();
    this.gameId = gameId;
    this.presetId = presetId;
    // Mirror the active game into the leaf key-helper module (see its header
    // for why the helpers cannot read this singleton directly).
    setGameEntityKeyGameId(gameId);
    // A new game selection restarts sync, so misses are expected again until
    // the client re-marks the config as synced.
    this.configSynced = false;
    this.warnedConfigMissSites.clear();
  }

  /** Called by the client bootstrap once the initial config sync completes;
   *  from then on empty keyed lookups warn instead of silently defaulting. */
  public markConfigSynced() {
    this.configSynced = true;
  }

  public getActiveGameId(): number {
    return this.gameId;
  }

  /** s2 only: whether the active game's registry row says the game is over.
   *  Legacy worlds signal this via the SeasonEnded event instead. */
  public isGameOver(): boolean {
    const game = this.getGameRegistry();
    if (!game) return false;
    const status = String(game.status);
    return status === "Ended" || status === "Settled";
  }

  /** Per-game state row: WorldConfig[gameId] on s2, WorldConfig[WORLD_CONFIG_ID] legacy. */
  private getWorldConfig() {
    const key = this.gameId > 0 ? BigInt(this.gameId) : WORLD_CONFIG_ID;
    return getComponentValue(this.components.WorldConfig, getEntityIdFromKeys([key]));
  }

  /** Immutable rulebook row for the active preset (s2 only; undefined on legacy). */
  private getPresetConfig() {
    if (this.presetId <= 0) return undefined;
    return getComponentValue(this.components.PresetConfig, getEntityIdFromKeys([BigInt(this.presetId)]));
  }

  /** The active game's registry row (clock/status/escrow). s2 only. */
  private getGameRegistry() {
    if (this.gameId <= 0) return undefined;
    return getComponentValue(this.components.GameRegistry, getEntityIdFromKeys([BigInt(this.gameId)]));
  }

  /** Rulebook members: PresetConfig[presetId] on s2. On legacy worlds the same
   *  members lived inline on WorldConfig — read them there via a structural cast. */
  private getRulebook() {
    if (this.presetId > 0) return this.getPresetConfig();
    return this.getWorldConfig() as unknown as ReturnType<ClientConfigManager["getPresetConfig"]>;
  }

  /** Season clock: GameRegistry row on s2; inline season_config on legacy worlds. */
  private getSeasonClock() {
    if (this.gameId > 0) {
      const game = this.getGameRegistry();
      if (!game) return undefined;
      return {
        start_settling_at: game.start_settling_at,
        start_main_at: game.start_main_at,
        end_at: game.end_at,
        end_grace_seconds: game.end_grace_seconds,
        registration_grace_seconds: game.registration_grace_seconds,
      };
    }
    return (this.getWorldConfig() as unknown as { season_config?: any })?.season_config;
  }

  /** Chain-wide singleton (addresses and agent controller). */
  private getChainConfig() {
    return getComponentValue(this.components.ChainConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
  }

  /** Rulebook side-table key prefix: preset-scoped on s2, bare on legacy. */
  private presetKey(...keys: bigint[]): bigint[] {
    return this.presetId > 0 ? [BigInt(this.presetId), ...keys] : keys;
  }

  public setDojo(components: ContractComponents, config: Config) {
    this.components = components;
    this.config = config;

    this.initializeResourceProduction();
    this.initializeHyperstructureTotalCosts();
    this.initializeRealmUpgradeCosts();
    this.initializeBuildingCosts();
    this.initializeStructureCosts();
    this.initializeResourceWeights();
    this.initializeMapCenter();
  }

  public static instance(): ClientConfigManager {
    if (!ClientConfigManager._instance) {
      ClientConfigManager._instance = new ClientConfigManager();
    }

    return ClientConfigManager._instance;
  }

  private getValueOrDefault<T>(callback: () => T | undefined | null, defaultValue: T): T {
    if (!this.components || !this.config) {
      return defaultValue;
    }

    try {
      const value = callback();
      if (value === undefined || value === null) {
        this.warnConfigMissOnce();
        return defaultValue;
      }
      this.reportConfigMissResolvedOnce();
      return value;
    } catch (error) {
      console.warn("ClientConfigManager fallback due to error", error);
      return defaultValue;
    }
  }

  /**
   * Loud once per call site, in every environment: packages/core is built
   * env-agnostic, and a config miss after sync is a bug worth one console
   * line even in prod (the silent {0,0} variant disabled the population UX
   * for weeks). The site key is the stack frame that called
   * getValueOrDefault — cheap, and keeps all getter signatures unchanged.
   */
  private warnConfigMissOnce() {
    if (!this.configSynced) return;
    const stackFrames = new Error().stack?.split("\n") ?? [];
    // Frame 0 is "Error", 1 this helper, 2 getValueOrDefault, 3 the getter.
    const site = (stackFrames[3] ?? "unknown-config-site").trim();
    if (this.warnedConfigMissSites.has(site)) return;
    this.warnedConfigMissSites.add(site);
    console.warn(`ClientConfigManager: config lookup returned empty after sync — using default (${site})`);
  }

  /**
   * Pairs with warnConfigMissOnce: one line when a previously-missed site
   * starts resolving, so a session capture can tell a boot-order race (miss
   * then resolved) from a persistent config miss (miss, never resolved). The
   * stack capture only runs while a miss is outstanding — the steady-state
   * hot path pays nothing. setActiveGame clears the set, resetting both
   * sides for the next game.
   */
  private reportConfigMissResolvedOnce() {
    if (this.warnedConfigMissSites.size === 0) return;
    const stackFrames = new Error().stack?.split("\n") ?? [];
    const site = (stackFrames[3] ?? "unknown-config-site").trim();
    if (!this.warnedConfigMissSites.delete(site)) return;
    console.warn(`ClientConfigManager: config miss resolved — lookups return real values again (${site})`);
  }

  private initializeMapCenter() {
    const worldConfig = this.getWorldConfig();
    if (worldConfig) {
      this.mapCenter = MAP_CENTER - Number(worldConfig.map_center_offset ?? 0);
    }
  }

  private initializeResourceWeights() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const weightConfig = getComponentValue(
        this.components.WeightConfig,
        getEntityIdFromKeys(this.presetKey(BigInt(resourceType))),
      );
      this.resourceWeightsKg[Number(resourceType)] = gramToKg(Number(weightConfig?.weight_gram ?? 0));
    }
  }

  private initializeResourceProduction() {
    if (!this.components) return;

    for (const resourceType of Object.values(ResourcesIds).filter(Number.isInteger)) {
      const productionConfig = getComponentValue(
        this.components.ResourceFactoryConfig,
        getEntityIdFromKeys(this.presetKey(BigInt(resourceType))),
      );

      const complexSystemResourceInputCount = productionConfig?.complex_input_list_count ?? 0;
      const complexSystemResourceInputEntityId = productionConfig?.complex_input_list_id ?? 0;
      const complexSystemResourceInputs: { resource: ResourcesIds; amount: number }[] = [];

      for (let index = 0; index < complexSystemResourceInputCount; index++) {
        const resource = getComponentValue(
          this.components.ResourceList,
          getEntityIdFromKeys(this.presetKey(BigInt(complexSystemResourceInputEntityId), BigInt(index))),
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
          getEntityIdFromKeys(this.presetKey(BigInt(simpleSystemResourceInputEntityId), BigInt(index))),
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
        this.components.HyperstrtConstructConfig,
        getEntityIdFromKeys(this.presetKey(BigInt(resourceType))),
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
    const maxLevel = Number(this.getRulebook()?.structure_max_level_config?.realm_max) || 0;

    for (let level = 1; level <= maxLevel; level++) {
      const levelConfig = getComponentValue(
        this.components.StructureLevelConfig,
        getEntityIdFromKeys(this.presetKey(BigInt(level))),
      );
      if (levelConfig) {
        const inputs: { resource: ResourcesIds; amount: number }[] = [];
        for (let index = 0; index < levelConfig.required_resource_count; index++) {
          const resource = getComponentValue(
            this.components.ResourceList,
            getEntityIdFromKeys(this.presetKey(BigInt(levelConfig.required_resources_id), BigInt(index))),
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
      if (
        buildingConfig &&
        this.presetId > 0 &&
        Number((buildingConfig as { preset_id?: number }).preset_id ?? 0) !== this.presetId
      ) {
        continue;
      }
      if (buildingConfig) {
        // Process complex building costs
        const complexEntityId = buildingConfig.complex_erection_cost_id;
        const complexResourceCount = buildingConfig.complex_erection_cost_count || 0;
        const complexInputs: { resource: ResourcesIds; amount: number }[] = [];

        for (let index = 0; index < complexResourceCount; index++) {
          const resource = getComponentValue(
            this.components.ResourceList,
            getEntityIdFromKeys(this.presetKey(BigInt(complexEntityId), BigInt(index))),
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
            getEntityIdFromKeys(this.presetKey(BigInt(simpleEntityId), BigInt(index))),
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

  public getResourceProductionResourceInputs(resourceId: ResourcesIds) {
    return this.complexSystemResourceInputs[resourceId] ?? this.simpleSystemResourceInputs[resourceId] ?? [];
  }

  public getRefillPerTick() {
    const staminaRefillConfig = this.getRulebook()?.troop_stamina_config;
    return staminaRefillConfig?.stamina_gain_per_tick || 0;
  }

  public getMaxLevel(category: StructureType) {
    if (category === StructureType.Realm) {
      return Number(this.getRulebook()?.structure_max_level_config?.realm_max ?? 0);
    } else if (category === StructureType.Village) {
      return Number(this.getRulebook()?.structure_max_level_config?.village_max ?? 0);
    }
    return 0;
  }

  public getHyperstructureTotalCosts() {
    return this.hyperstructureTotalCosts;
  }

  public getHyperstructureConstructionCosts() {
    return {
      amount: this.divideByPrecision(Number(this.getRulebook()?.hyperstructure_config?.initialize_shards_amount) ?? 0),
      resource: ResourcesIds.AncientFragment,
    };
  }

  // weight in grams, per actual resource (without precision)
  getResourceWeightKg(resourceId: number): number {
    return this.resourceWeightsKg[resourceId] || 0;
  }
  getTravelStaminaCost(biome: BiomeType, troopType: TroopType) {
    return this.getValueOrDefault(() => {
      // A missing rulebook row must reach getValueOrDefault as a miss so the
      // loud layer fires (guardrail #2); field-level defaults stay as-is.
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      const staminaConfig = rulebook.troop_stamina_config;
      const baseStaminaCost = staminaConfig?.stamina_travel_stamina_cost || 0;
      const biomeBonus = staminaConfig?.stamina_bonus_value || 0;

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
          return baseStaminaCost; // No modifier
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
    const biomeBonusNum = this.getRulebook()?.troop_damage_config?.damage_biome_bonus_num || 0;
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
      // Scorched biome: +30% crossbowman, 0% knight, -30% paladin
      [BiomeType.Scorched]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  }

  getExploreStaminaCost() {
    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return rulebook.troop_stamina_config?.stamina_explore_stamina_cost ?? 0;
    }, 1);
  }

  getSeasonMainGameStartAt() {
    return this.getValueOrDefault(() => {
      const startMainAt = this.getSeasonClock()?.start_main_at;

      return startMainAt;
    }, 0);
  }

  getExploreReward() {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        const worldConfig = this.getWorldConfig();
        if (!worldConfig) return undefined;
        const exploreConfig = rulebook.map_config;

        // A silently-missed WorldConfig row would flip the reward resource
        // (Essence vs AncientFragment), so it is guarded above, not defaulted.
        const blitzModeOn = worldConfig.blitz_mode_on;

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
        guard_resurrection_delay: 0,
        mercenaries_troop_lower_bound: 0,
        mercenaries_troop_upper_bound: 0,
        agents_troop_lower_bound: 0,
        agents_troop_upper_bound: 0,
        settlement_deployment_cap: 0,
        city_deployment_cap: 0,
        kingdom_deployment_cap: 0,
        empire_deployment_cap: 0,
        t1_tier_strength: 0,
        t2_tier_strength: 0,
        t3_tier_strength: 0,
        t1_tier_modifier: 0,
        t2_tier_modifier: 0,
        t3_tier_modifier: 0,
      },

      troop_stamina_config: {
        stamina_gain_per_tick: 0,
        stamina_initial: 0,
        stamina_bonus_value: 0,
        stamina_knight_max: 0,
        stamina_paladin_max: 0,
        stamina_crossbowman_max: 0,
        stamina_attack_req: 0,
        stamina_defense_req: 0,
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
      const rulebook = this.getRulebook();

      // Miss must reach getValueOrDefault so it warns after sync; the loud
      // layer returns defaultTroopConfig either way. The cast keeps the
      // getter's return type the same union it always was.
      if (!rulebook) return undefined as typeof defaultTroopConfig | undefined;

      const { troop_damage_config, troop_limit_config, troop_stamina_config } = rulebook;

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

  getMaxArmySize(level: number, tier: TroopTier): number {
    const config = this.getTroopConfig().troop_limit_config;

    const deploymentCap =
      [
        config.settlement_deployment_cap,
        config.city_deployment_cap,
        config.kingdom_deployment_cap,
        config.empire_deployment_cap,
      ][level] ?? config.settlement_deployment_cap;

    const tierParams: Record<TroopTier, { strength: number; modifier: number }> = {
      [TroopTier.T1]: { strength: config.t1_tier_strength, modifier: config.t1_tier_modifier },
      [TroopTier.T2]: { strength: config.t2_tier_strength, modifier: config.t2_tier_modifier },
      [TroopTier.T3]: { strength: config.t3_tier_strength, modifier: config.t3_tier_modifier },
    };

    const { strength, modifier } = tierParams[tier];
    const modifierPrecision = 100;
    if (strength === 0) return 0;
    return Math.floor((deploymentCap * modifier) / (strength * modifierPrecision));
  }

  getCombatConfig() {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        const combatConfig = rulebook.troop_damage_config;

        const troopStaminaConfig = rulebook.troop_stamina_config;

        return {
          stamina_bonus_value: troopStaminaConfig?.stamina_bonus_value ?? 0,
          stamina_attack_req: troopStaminaConfig?.stamina_attack_req ?? 0,
          stamina_defense_req: troopStaminaConfig?.stamina_defense_req ?? 0,
          damage_biome_bonus_num: combatConfig?.damage_biome_bonus_num ?? 0,
          damage_raid_percent_num: combatConfig?.damage_raid_percent_num ?? 0,
          damage_beta_small: BigInt(combatConfig?.damage_beta_small ?? 0),
          damage_beta_large: BigInt(combatConfig?.damage_beta_large ?? 0),
          damage_scaling_factor: combatConfig?.damage_scaling_factor ?? 0n,
          damage_c0: combatConfig?.damage_c0 ?? 0n,
          damage_delta: combatConfig?.damage_delta ?? 0n,
          t1_damage_value: combatConfig?.t1_damage_value ?? 0n,
          t2_damage_multiplier: combatConfig?.t2_damage_multiplier ?? 0n,
          t3_damage_multiplier: combatConfig?.t3_damage_multiplier ?? 0n,
          tick_interval_seconds: 60,
        };
      },
      {
        stamina_bonus_value: 0,
        stamina_attack_req: 0,
        stamina_defense_req: 0,
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
        tick_interval_seconds: 60,
      },
    );
  }

  getBattleGraceTickCount() {
    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return Number(rulebook.battle_config?.regular_immunity_ticks ?? 0);
    }, 0);
  }

  getVillageSettlementImmunityTickCount() {
    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return Number(rulebook.battle_config?.village_immunity_ticks ?? 0);
    }, 0);
  }

  getVillagePostRaidImmunityTickCount() {
    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return Number(rulebook.battle_config?.village_raid_immunity_ticks ?? 0);
    }, 0);
  }

  getMinTravelStaminaCost() {
    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      const staminaConfig = rulebook.troop_stamina_config;
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
      [StructureType.HolySite]: 1,
      [StructureType.Camp]: 1,
      [StructureType.BitcoinMine]: 1,
    };
  }

  getResourceBridgeFeeSplitConfig() {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook() as unknown as Record<string, any> | undefined;
        if (!rulebook) return undefined;
        const resourceBridgeFeeSplitConfig = rulebook.res_bridge_fee_split_config;
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
    // Fixed 1s tick never reads config — it must hold before hydration too,
    // ahead of getValueOrDefault's not-hydrated-yet default.
    if (tickId === TickIds.Default) return 1;

    return this.getValueOrDefault(() => {
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      const tickConfig = rulebook.tick_config;

      if (tickId === TickIds.Armies) {
        return Number(tickConfig?.armies_tick_in_seconds ?? 0);
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
        const rulebook = this.getRulebook() as unknown as Record<string, any> | undefined;
        if (!rulebook) return undefined;
        const bankConfig = rulebook.bank_config;

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
    const bankConfig = (this.getRulebook() as unknown as Record<string, any> | undefined)?.bank_config;
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
      // None never reads config — stays silent on a missing row.
      if (category === CapacityConfig.None) return 0;

      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      const nonStructureCapacityConfig = rulebook.capacity_config;

      const structureCapacityConfig = rulebook.structure_capacity_config;

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
        default:
          throw new Error("Invalid capacity config category");
      }

      // Convert from grams to kg by dividing by 1000
      return gramToKg(capacityInGrams);
    }, 0);
  }

  getSpeedConfig(entityType: EntityType): number {
    return this.getValueOrDefault(() => {
      if (entityType !== EntityType.DONKEY) {
        throw new Error("Undefined entity type in getSpeedConfig");
      }

      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return Number(rulebook.speed_config?.donkey_sec_per_km ?? 0);
    }, 0);
  }

  getBuildingConfig() {
    return this.getValueOrDefault(() => this.getRulebook()?.building_config, {
      base_population: 0,
      base_cost_percent_increase: 0,
    });
  }

  getBlitzConfig() {
    return this.getValueOrDefault(
      () => {
        const config = this.getWorldConfig();
        if (!config) return;
        const chain = this.getChainConfig();
        const rules = this.getRulebook()?.blitz_registration_rules_config;
        const clock = this.getSeasonClock();

        const blitzSettlementConfig = config.blitz_settlement_config;
        const blitzRegistrationConfig = config.blitz_registration_config;
        const blitzHypersSettlementConfig = config.blitz_hypers_settlement_config;
        const settlementConfig = config.settlement_config;
        const twoPlayerMode = Boolean(blitzSettlementConfig.two_player_mode);
        const blitzHyperStructureCount =
          getComponentValue(
            this.components.HyperstructureGlobals,
            getEntityIdFromKeys([this.gameId > 0 ? BigInt(this.gameId) : BigInt(WORLD_CONFIG_ID)]),
          )?.created_count || 0;

        // get number of hyperstructures left to create
        let numHyperStructuresLeft = twoPlayerMode ? Number(blitzHypersSettlementConfig.max_ring_count) + 1 : 1;
        if (!twoPlayerMode) {
          for (let i = 1; i <= blitzHypersSettlementConfig.max_ring_count; i++) {
            numHyperStructuresLeft += 6 * i;
          }
        }
        numHyperStructuresLeft -= blitzHyperStructureCount;

        // get number of spires left to create
        const spiresMaxCount = Number(settlementConfig?.spires_max_count ?? 0);
        const spiresSettledCount = Number(settlementConfig?.spires_settled_count ?? 0);
        const numSpiresLeft = Math.max(spiresMaxCount - spiresSettledCount, 0);

        return {
          blitz_mode_on: config?.blitz_mode_on ?? false,
          blitz_settlement_config: {
            base_distance: Number(blitzSettlementConfig.base_distance),
            side: Number(blitzSettlementConfig.side),
            step: Number(blitzSettlementConfig.step),
            point: Number(blitzSettlementConfig.point),
            single_realm_mode: Boolean(blitzSettlementConfig.single_realm_mode),
            two_player_mode: twoPlayerMode,
          },
          blitz_exploration_config: {
            reward_profile_id: Number(this.getRulebook()?.blitz_exploration_config?.reward_profile_id ?? 0),
          },
          blitz_registration_config: {
            collectibles_cosmetics_max: BigInt(rules?.collectibles_cosmetics_max ?? 0),
            collectibles_cosmetics_address: BigInt(chain?.collectibles_cosmetics_address ?? 0),
            collectibles_timelock_address: BigInt(chain?.collectibles_timelock_address ?? 0),
            collectibles_lootchest_address: BigInt(chain?.collectibles_lootchest_address ?? 0),
            collectibles_elitenft_address: BigInt(chain?.collectibles_elitenft_address ?? 0),
            registration_count: Number(blitzRegistrationConfig.registration_count),
            registration_count_max: Number(blitzRegistrationConfig.registration_count_max),
            registration_start_at: Number(blitzRegistrationConfig.registration_start_at),
            registration_end_at: Number(clock?.start_main_at ?? 0),
            creation_start_at: Number(clock?.start_main_at ?? 0) + 1,
            creation_end_at: Number(clock?.end_at ?? 0),
            // s2: settlement positions are assigned at settle; registration_count tracks them.
            assigned_positions_count: Number(blitzRegistrationConfig.registration_count),
          },
          blitz_num_hyperstructures_left: Math.max(numHyperStructuresLeft, 0),
          num_spires_left: numSpiresLeft,
          spires_settled_count: spiresSettledCount,
        };
      },
      {
        blitz_mode_on: false,
        blitz_settlement_config: {
          base_distance: 0,
          side: 0,
          step: 0,
          point: 0,
          single_realm_mode: false,
          two_player_mode: false,
        },
        blitz_exploration_config: {
          reward_profile_id: 0,
        },
        blitz_registration_config: {
          collectibles_cosmetics_max: BigInt(0),
          collectibles_cosmetics_address: BigInt(0),
          collectibles_timelock_address: BigInt(0),
          collectibles_lootchest_address: BigInt(0),
          collectibles_elitenft_address: BigInt(0),
          registration_count: 0,
          registration_count_max: 0,
          registration_start_at: 0,
          registration_end_at: 0,
          creation_start_at: 0,
          creation_end_at: 0,
          assigned_positions_count: 0,
        },
        blitz_num_hyperstructures_left: 0,
        num_spires_left: 0,
        spires_settled_count: 0,
      },
    );
  }

  getDevModeConfig() {
    return this.getValueOrDefault(
      () => {
        if (this.gameId > 0) {
          const game = this.getGameRegistry();
          if (!game) return undefined;
          return { dev_mode_on: game.dev_mode_on ?? false };
        }
        const worldConfig = this.getWorldConfig() as unknown as
          | { season_config?: { dev_mode_on?: boolean } }
          | undefined;
        if (!worldConfig) return undefined;
        return { dev_mode_on: worldConfig.season_config?.dev_mode_on ?? false };
      },
      {
        dev_mode_on: false,
      },
    );
  }

  getHyperstructureConfig() {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        const victoryPointsGrantConfig = rulebook.victory_points_grant_config;

        const victoryPointsWinConfig = rulebook.victory_points_win_config;

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
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return rulebook.building_config?.base_population ?? 0;
    }, 0);
  }

  getBuildingCategoryConfig(buildingType: BuildingType) {
    return this.getValueOrDefault(
      () => {
        const buildingCategoryConfig = getComponentValue(
          this.components.BuildingCategoryConfig,
          getEntityIdFromKeys(this.presetKey(BigInt(buildingType))),
        );
        // A missing row must reach getValueOrDefault as a miss, not be masked
        // into {0, 0} here — a silent zero disables the entire population UX.
        if (!buildingCategoryConfig) return undefined;
        return {
          population_cost: buildingCategoryConfig.population_cost,
          capacity_grant: buildingCategoryConfig.capacity_grant,
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
        getEntityIdFromKeys(this.presetKey(BigInt(resourceType))),
      );

      return Number(productionConfig?.realm_output_per_second ?? 0);
    }, 0);
  }

  getTravelFoodCostConfig(troopType: number) {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        const travelFoodCostConfig = rulebook.troop_stamina_config;

        return {
          exploreWheatBurnAmount:
            travelFoodCostConfig?.stamina_explore_wheat_cost !== undefined
              ? Number(travelFoodCostConfig.stamina_explore_wheat_cost) / Number(RESOURCE_PRECISION)
              : 0,
          exploreFishBurnAmount:
            travelFoodCostConfig?.stamina_explore_fish_cost !== undefined
              ? Number(travelFoodCostConfig.stamina_explore_fish_cost) / Number(RESOURCE_PRECISION)
              : 0,
          travelWheatBurnAmount:
            travelFoodCostConfig?.stamina_travel_wheat_cost !== undefined
              ? Number(travelFoodCostConfig.stamina_travel_wheat_cost) / Number(RESOURCE_PRECISION)
              : 0,
          travelFishBurnAmount:
            travelFoodCostConfig?.stamina_travel_fish_cost !== undefined
              ? Number(travelFoodCostConfig.stamina_travel_fish_cost) / Number(RESOURCE_PRECISION)
              : 0,
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
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        const staminaConfig = rulebook.troop_stamina_config;

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
      const rulebook = this.getRulebook();
      if (!rulebook) return undefined;
      return rulebook.building_config?.base_cost_percent_increase ?? 0;
    }, 0);
  }

  getSeasonConfig() {
    return this.getValueOrDefault(
      () => {
        const seasonConfig = this.getSeasonClock();
        if (!seasonConfig) return undefined;
        return {
          startSettlingAt: seasonConfig.start_settling_at ?? 0,
          startMainAt: seasonConfig.start_main_at ?? 0,
          endAt: seasonConfig.end_at ?? 0,
          bridgeCloseAfterEndSeconds: seasonConfig.end_grace_seconds ?? 0,
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

  getArtificerConfig() {
    return this.getValueOrDefault(
      () => {
        const rulebook = this.getRulebook();
        if (!rulebook) return undefined;
        return {
          research_cost_for_relic: Number(rulebook.artificer_config?.research_cost_for_relic ?? 0),
        };
      },
      {
        research_cost_for_relic: 0,
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
        return { withinTileDistance: 0, bonusPercentNum: 0 };
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

  getMapCenter() {
    return this.mapCenter;
  }

  getBiomeClimateConfig(): BiomeClimateConfig | undefined {
    return this.getValueOrDefault(() => {
      const worldConfig = this.getWorldConfig();
      return worldConfig?.biome_climate_config as BiomeClimateConfig | undefined;
    }, undefined);
  }

  getBiome(col: number, row: number): BiomeType {
    return Biome.getBiome(col, row, this.getBiomeClimateConfig() ?? NEUTRAL_BIOME_CLIMATE);
  }
}

export const configManager = ClientConfigManager.instance();

/**
 * Per-game rows in a multi-game store: does this row belong to the active
 * game? Unscoped boots and landing flows can leave other games' rows in RECS,
 * so any read that aggregates a game-keyed model's VALUES (rather than looking
 * up by a gameEntityKey, which embeds the game id) must filter through this.
 * Legacy single-game worlds have no active game id and accept every row.
 */
export const belongsToActiveGame = (value: { game_id?: unknown } | undefined | null): boolean => {
  if (!value) return false;
  const activeGameId = ClientConfigManager.instance().getActiveGameId();
  if (!(activeGameId > 0)) return true;
  return Number(value.game_id ?? 0) === activeGameId;
};

// The key helpers live in ./game-entity-keys (a leaf module). worldConfigKey
// is not re-exported here: its only consumers import the subpath entry.
export { buildingEntityKey, gameEntityKey } from "./game-entity-keys";
