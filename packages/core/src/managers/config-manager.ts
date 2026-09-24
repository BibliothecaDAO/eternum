import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import {
  BiomeType,
  BuildingType,
  CapacityConfig,
  EntityType,
  getProducedResource,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TickIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { buildingCostModeOf, type BuildingCostMode } from "../utils/building-cost-mode";
import { hasEnabledProductionPath } from "../utils/production-path";
import { troopStaminaLimits } from "./troop-stamina";
import { disposeActiveGameSyncRuntime } from "../sync/game-sync-runtime";
import { getBlockTimestamp } from "../utils/timestamp";
import { nativeGameModeOf } from "../utils/native-preset-mode";
import { Biome, type BiomeClimateConfig } from "../utils/biome";

const MAP_CENTER = 2147483646;
type ResourceAmount = { readonly resource_type: number; readonly amount: bigint };
const displayAmounts = (rows: readonly ResourceAmount[]) =>
  rows.map(({ resource_type, amount }) => ({
    resource: resource_type as ResourcesIds,
    amount: Number(amount) / RESOURCE_PRECISION,
  }));

/** Configuration is read from the active game's immutable facts, without a second balance table. */
export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private store?: NativeFactStore;
  private gameId = 0;

  public static instance(): ClientConfigManager {
    return (ClientConfigManager._instance ??= new ClientConfigManager());
  }

  public setActiveGame(gameId: number, _presetId: number) {
    if (!Number.isSafeInteger(gameId) || gameId <= 0) throw new Error("A positive game id is required");
    disposeActiveGameSyncRuntime();
    this.store = undefined;
    this.gameId = gameId;
  }

  public setStore(store: NativeFactStore) {
    this.store = store;
    this.rules();
  }

  public getActiveGameId() {
    return this.gameId;
  }

  private facts(): NativeFactStore {
    if (!this.store) throw new Error("Game configuration is not synchronized");
    return this.store;
  }

  private rules() {
    return this.facts().require("SliceRules", { game_id: this.gameId });
  }
  private game() {
    return this.facts().require("GameRegistry", { game_id: this.gameId });
  }

  public isGameOver(): boolean {
    const game = this.game();
    return game.settled || (game.end_at !== 0n && BigInt(getBlockTimestamp().currentBlockTimestamp) >= game.end_at);
  }

  get complexSystemResourceInputs() {
    return Object.fromEntries(
      [...this.facts().inGame("ProductionRecipe", this.gameId)].map((row) => [
        row.resource_type,
        displayAmounts(row.complex_inputs),
      ]),
    );
  }
  get simpleSystemResourceInputs() {
    return Object.fromEntries(
      [...this.facts().inGame("ProductionRecipe", this.gameId)].map((row) => [
        row.resource_type,
        displayAmounts(row.simple_inputs),
      ]),
    );
  }
  get complexSystemResourceOutput() {
    return Object.fromEntries(
      [...this.facts().inGame("ProductionRecipe", this.gameId)].map((row) => [
        row.resource_type,
        { resource: row.resource_type, amount: this.divideByPrecision(Number(row.complex_output)) },
      ]),
    );
  }
  get simpleSystemResourceOutput() {
    return Object.fromEntries(
      [...this.facts().inGame("ProductionRecipe", this.gameId)].map((row) => [
        row.resource_type,
        { resource: row.resource_type, amount: this.divideByPrecision(Number(row.simple_output)) },
      ]),
    );
  }
  get resourceOutputRate() {
    return Object.fromEntries(
      [...this.facts().inGame("ResourceRule", this.gameId)].map((row) => [
        row.resource_type,
        {
          resource: row.resource_type,
          realm_output_per_second: Number(row.realm_rate),
          village_output_per_second: Number(row.village_rate),
        },
      ]),
    );
  }
  get realmUpgradeCosts() {
    return Object.fromEntries(
      [...this.facts().inGame("UpgradeRecipe", this.gameId)].map((row) => [row.level, displayAmounts(row.costs)]),
    );
  }
  get complexBuildingCosts() {
    return Object.fromEntries(
      [...this.facts().inGame("BuildingRule", this.gameId)].map((row) => [
        row.category,
        displayAmounts(row.complex_cost),
      ]),
    );
  }
  /** Which building costs this game's rules carry; see buildingCostModeOf. */
  get buildingCostMode(): BuildingCostMode {
    return buildingCostModeOf(this.facts().inGame("BuildingRule", this.gameId));
  }
  get simpleBuildingCosts() {
    return Object.fromEntries(
      [...this.facts().inGame("BuildingRule", this.gameId)].map((row) => [
        row.category,
        displayAmounts(row.simple_cost),
      ]),
    );
  }
  get structureCosts() {
    return { [StructureType.Hyperstructure]: [this.getHyperstructureConstructionCosts()] };
  }
  get buildingOutputs() {
    return Object.fromEntries(
      [...this.facts().inGame("BuildingRule", this.gameId)].map((row) => [
        row.category,
        getProducedResource(row.category),
      ]),
    );
  }
  get resourceWeightsKg() {
    return Object.fromEntries(
      [...this.facts().inGame("ResourceRule", this.gameId)].map((row) => [
        row.resource_type,
        Number(row.unit_weight) / 1000,
      ]),
    );
  }
  get hyperstructureTotalCosts() {
    return this.getHyperstructureTotalCosts();
  }
  get mapCenter() {
    return this.getMapCenter();
  }

  getResourceProductionResourceInputs(resourceId: ResourcesIds) {
    return displayAmounts(
      this.facts().require("ProductionRecipe", { game_id: this.gameId, resource_type: resourceId }).complex_inputs,
    );
  }
  getRefillPerTick() {
    return this.rules().troop_stamina_config.stamina_gain_per_tick;
  }
  getMaxLevel(category: StructureType) {
    const limits = this.facts().require("UpgradeLimits", { game_id: this.gameId });
    if (category === StructureType.Realm) return limits.realm_max;
    if (category === StructureType.Village) return limits.village_max;
    return 0;
  }
  getHyperstructureTotalCosts() {
    return this.facts()
      .require("HyperstructureRules", { game_id: this.gameId })
      .resources.map((row) => ({
        resource: row.resource_type as ResourcesIds,
        min_amount: row.minimum,
        max_amount: row.maximum,
      }));
  }
  getHyperstructureConstructionCosts() {
    return {
      resource: ResourcesIds.AncientFragment,
      amount: this.divideByPrecision(
        Number(this.facts().require("HyperstructureRules", { game_id: this.gameId }).initialize_shards),
      ),
    };
  }
  getResourceWeightKg(resourceId: number) {
    return (
      Number(this.facts().require("ResourceRule", { game_id: this.gameId, resource_type: resourceId }).unit_weight) /
      1000
    );
  }
  getTravelStaminaCost(biome: BiomeType, troopType: TroopType) {
    const config = this.rules().troop_stamina_config;
    let modifier = 0;
    if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) modifier = -1;
    else if (biome === BiomeType.Scorched) modifier = 1;
    else if (troopType === TroopType.Paladin) {
      if (
        [
          BiomeType.Grassland,
          BiomeType.Shrubland,
          BiomeType.SubtropicalDesert,
          BiomeType.TemperateDesert,
          BiomeType.Tundra,
          BiomeType.Bare,
        ].includes(biome)
      )
        modifier = -1;
      else if (
        [
          BiomeType.TropicalRainForest,
          BiomeType.TropicalSeasonalForest,
          BiomeType.TemperateRainForest,
          BiomeType.TemperateDeciduousForest,
          BiomeType.Taiga,
        ].includes(biome)
      )
        modifier = 1;
    }
    return config.stamina_travel_stamina_cost + modifier * config.stamina_bonus_value;
  }
  /** Whether terrain changes combat in this game at all; where it does not, no surface shows biome bonuses. */
  hasBiomeCombatEffects(): boolean {
    return this.rules().troop_damage_config.damage_biome_bonus_num > 0;
  }
  public getBiomeCombatBonus(troopType: TroopType, biome: BiomeType): number {
    const biomeBonusNum = this.rules().troop_damage_config.damage_biome_bonus_num;
    const biomeBonus = biomeBonusNum / 10_000;

    const biomeModifiers: Record<BiomeType, Record<TroopType, number>> = {
      [BiomeType.Underground]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0 },
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
    return this.rules().troop_stamina_config.stamina_explore_stamina_cost;
  }
  getSeasonMainGameStartAt() {
    return Number(this.game().start_main_at);
  }
  getExploreReward() {
    const rules = this.rules();
    const reward_resource =
      nativeGameModeOf(this.game().preset_id) === "eternum" ? ResourcesIds.AncientFragment : ResourcesIds.Essence;
    const resource_amount = rules.map_config.reward_resource_amount;
    return {
      reward_resource,
      resource_amount,
      resource_weight: (resource_amount * this.getResourceWeightKg(reward_resource)) / RESOURCE_PRECISION,
    };
  }
  getTroopConfig() {
    const rules = this.rules();
    return {
      troop_damage_config: rules.troop_damage_config,
      troop_stamina_config: rules.troop_stamina_config,
      troop_limit_config: { ...rules.troop_limit_config, troops_per_military_building: 1, max_defense_armies: 4 },
    };
  }
  getMaxArmySize(level: number, tier: TroopTier): number {
    const config = this.rules().troop_limit_config;
    const cap = [
      config.settlement_deployment_cap,
      config.city_deployment_cap,
      config.kingdom_deployment_cap,
      config.empire_deployment_cap,
    ][level];
    const tierIndex = [TroopTier.T1, TroopTier.T2, TroopTier.T3].indexOf(tier);
    if (cap === undefined || tierIndex < 0) throw new Error("Unknown army level or tier");
    const strength = [config.t1_tier_strength, config.t2_tier_strength, config.t3_tier_strength][tierIndex];
    const modifier = [config.t1_tier_modifier, config.t2_tier_modifier, config.t3_tier_modifier][tierIndex];
    return strength === 0 ? 0 : Math.floor((cap * modifier) / (strength * 100));
  }
  getCombatConfig() {
    const rules = this.rules();
    return {
      ...rules.troop_damage_config,
      stamina_bonus_value: rules.troop_stamina_config.stamina_bonus_value,
      stamina_attack_req: rules.troop_stamina_config.stamina_attack_req,
      stamina_defense_req: rules.troop_stamina_config.stamina_defense_req,
      tick_interval_seconds: this.getTick(TickIds.Armies),
    };
  }
  getBattleGraceTickCount() {
    return this.rules().battle_config.regular_immunity_ticks;
  }
  getVillageSettlementImmunityTickCount() {
    return this.rules().battle_config.village_immunity_ticks;
  }
  getVillagePostRaidImmunityTickCount() {
    return this.rules().battle_config.village_raid_immunity_ticks;
  }
  getMinTravelStaminaCost() {
    const config = this.rules().troop_stamina_config;
    return Math.max(config.stamina_travel_stamina_cost - config.stamina_bonus_value, 10);
  }
  getWorldStructureDefenseSlotsConfig() {
    return {
      [StructureType.Mine]: 1,
      [StructureType.Hyperstructure]: 4,
      [StructureType.Bank]: 4,
      [StructureType.Camp]: 1,
      [StructureType.BitcoinMine]: 4,
    };
  }
  getResourceBridgeFeeSplitConfig() {
    const deposit = this.facts().require("DepositRules", { game_id: this.gameId });
    const withdrawal = this.facts().require("WithdrawalRules", { game_id: this.gameId });
    return {
      velords_fee_on_dpt_percent: deposit.velords_fee_bps,
      velords_fee_on_wtdr_percent: withdrawal.velords_fee_bps,
      season_pool_fee_on_dpt_percent: deposit.season_fee_bps,
      season_pool_fee_on_wtdr_percent: withdrawal.season_fee_bps,
      client_fee_on_dpt_percent: deposit.client_fee_bps,
      client_fee_on_wtdr_percent: withdrawal.client_fee_bps,
      velords_fee_recipient: withdrawal.velords_recipient,
      season_pool_fee_recipient: withdrawal.season_recipient,
      realm_fee_dpt_percent: deposit.realm_fee_bps,
      realm_fee_wtdr_percent: withdrawal.bank_fee_bps,
    };
  }
  getTick(tickId: TickIds): number {
    if (tickId === TickIds.Default) return 1;
    const config = this.rules().tick_config;
    if (tickId === TickIds.Armies) return Number(config.armies_tick_in_seconds);
    if (tickId === TickIds.Delivery) return Number(config.delivery_tick_in_seconds);
    throw new Error("Unknown tick id");
  }
  getBankConfig() {
    const rule = this.facts().require("BankRules", { game_id: this.gameId });
    return { lpFeesNumerator: rule.lp_fee_num, lpFeesDenominator: rule.lp_fee_denom };
  }
  getAdminBankOwnerFee() {
    const rule = this.facts().require("BankRules", { game_id: this.gameId });
    return rule.owner_fee_num / rule.owner_fee_denom;
  }
  getAdminBankLpFee() {
    const rule = this.getBankConfig();
    return rule.lpFeesNumerator / rule.lpFeesDenominator;
  }
  getCapacityConfigKg(category: CapacityConfig) {
    if (category === CapacityConfig.None) return 0;
    const { capacity_config: general, structure_capacity_config: structures } = this.rules();
    const grams = {
      [CapacityConfig.RealmStructure]: structures.realm_capacity,
      [CapacityConfig.VillageStructure]: structures.village_capacity,
      [CapacityConfig.HyperstructureStructure]: structures.hyperstructure_capacity,
      [CapacityConfig.FragmentMineStructure]: structures.fragment_mine_capacity,
      [CapacityConfig.BankStructure]: structures.bank_structure_capacity,
      [CapacityConfig.CampStructure]: structures.camp_capacity,
      [CapacityConfig.BitcoinMineStructure]: structures.bitcoin_mine_capacity,
      [CapacityConfig.Donkey]: general.donkey_capacity,
      [CapacityConfig.Army]: general.troop_capacity,
      [CapacityConfig.Storehouse]: general.storehouse_boost_capacity,
    }[category];
    if (grams === undefined) throw new Error("Unknown capacity category");
    return Number(grams) / 1000;
  }
  getSpeedConfig(entityType: EntityType): number {
    if (entityType !== EntityType.DONKEY) throw new Error("Unknown entity speed");
    return this.rules().speed_config.donkey_sec_per_km;
  }
  getBuildingConfig() {
    return this.rules().building_config;
  }
  getPresetId(): number {
    return this.game().preset_id;
  }
  isCommandEnabled(command: keyof typeof nativeCommandBits): boolean {
    return (this.rules().command_mask & BigInt(nativeCommandBits[command])) !== 0n;
  }
  /** Whether a player can refill this resource's production in this game; see hasEnabledProductionPath. */
  canRefillProduction(resourceId: number): boolean {
    return hasEnabledProductionPath(
      this.facts().get("ProductionRecipe", { game_id: this.gameId, resource_type: resourceId }),
      {
        labor: this.isCommandEnabled("BurnLaborForResourceProduction"),
        resource: this.isCommandEnabled("BurnResourceForResourceProduction"),
      },
    );
  }
  getSettlementConfig() {
    return this.facts().require("SettlementRules", { game_id: this.gameId });
  }
  getDevModeConfig() {
    return { dev_mode_on: this.game().dev_mode_on };
  }
  getHyperstructureConfig() {
    return {
      timeBetweenSharesChange: 0,
      pointsPerCycle: this.rules().victory_points_grant_config.hyp_points_per_second / RESOURCE_PRECISION,
      pointsForWin:
        Number(this.facts().require("SeasonWinThreshold", { game_id: this.gameId }).points) / RESOURCE_PRECISION,
    };
  }
  getRelicCrateReward() {
    const rules = this.rules();
    return {
      relicsPerCrate: rules.map_config.relic_chest_relics_per_chest,
      victoryPoints: rules.victory_points_grant_config.relic_open_points / RESOURCE_PRECISION,
    };
  }
  getBasePopulationCapacity() {
    return this.rules().building_config.base_population;
  }
  getBuildingCategoryConfig(buildingType: BuildingType) {
    const rule = this.facts().require("BuildingRule", { game_id: this.gameId, category: buildingType });
    return { population_cost: rule.population_cost, capacity_grant: rule.capacity_grant };
  }
  getResourceOutputs(resourceType: number) {
    return Number(
      this.facts().require("ResourceRule", { game_id: this.gameId, resource_type: resourceType }).realm_rate,
    );
  }
  getTravelFoodCostConfig(_troopType: number) {
    const config = this.rules().troop_stamina_config;
    return {
      exploreWheatBurnAmount: config.stamina_explore_wheat_cost / RESOURCE_PRECISION,
      exploreFishBurnAmount: config.stamina_explore_fish_cost / RESOURCE_PRECISION,
      travelWheatBurnAmount: config.stamina_travel_wheat_cost / RESOURCE_PRECISION,
      travelFishBurnAmount: config.stamina_travel_fish_cost / RESOURCE_PRECISION,
    };
  }
  getTroopStaminaConfig(troopType: TroopType, troopTier: TroopTier) {
    return troopStaminaLimits(this.getTroopStaminaRules(), troopType, troopTier);
  }
  getTroopStaminaRules() {
    return this.rules().troop_stamina_config;
  }
  getResourcePrecision() {
    return RESOURCE_PRECISION;
  }
  divideByPrecision(value: number) {
    return value / RESOURCE_PRECISION;
  }
  getResourceBuildingProduced(buildingType: BuildingType) {
    return getProducedResource(buildingType);
  }
  getBuildingBaseCostPercentIncrease() {
    return this.rules().building_config.base_cost_percent_increase;
  }
  getSeasonConfig() {
    const game = this.game();
    return {
      startSettlingAt: Number(game.start_settling_at),
      startMainAt: Number(game.start_main_at),
      endAt: Number(game.end_at),
      bridgeCloseAfterEndSeconds: game.end_grace_seconds,
    };
  }
  getSpireTravelEssenceCost() {
    return this.divideByPrecision(Number(this.rules().spire_travel_essence_cost));
  }
  getArtificerConfig() {
    return {
      research_cost_for_relic: Number(this.facts().require("ArtificerCost", { game_id: this.gameId }).research),
    };
  }
  getLaborConfig(resourceId: number) {
    const recipe = this.facts().require("ProductionRecipe", { game_id: this.gameId, resource_type: resourceId });
    const labor = this.facts().require("ResourceRule", { game_id: this.gameId, resource_type: ResourcesIds.Labor });
    return {
      laborBurnPerResourceOutput: this.divideByPrecision(
        Number(recipe.simple_inputs.find((input) => input.resource_type === ResourcesIds.Labor)?.amount ?? 0n),
      ),
      laborRatePerTick: this.divideByPrecision(Number(labor.realm_rate)),
      inputResources: displayAmounts(recipe.simple_inputs),
      resourceOutputPerInputResources: this.divideByPrecision(Number(recipe.simple_output)),
    };
  }
  getMapCenter() {
    return MAP_CENTER - this.rules().map_center_offset;
  }
  getBiomeClimateConfig(): BiomeClimateConfig {
    return this.rules().biome_climate_config;
  }
  getBiome(col: number, row: number): BiomeType {
    return Biome.getBiome(col, row, this.getBiomeClimateConfig());
  }
}

export const configManager = ClientConfigManager.instance();
