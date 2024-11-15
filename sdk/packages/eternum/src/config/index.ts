import { Account } from "starknet";
import {
  ADMIN_BANK_ENTITY_ID,
  ARMY_ENTITY_TYPE,
  DONKEY_ENTITY_TYPE,
  QUEST_RESOURCES,
  QuestType,
  ResourcesIds,
} from "../constants";
import { BuildingType } from "../constants/structures";
import { EternumProvider } from "../provider";
import { Config as EternumGlobalConfig, ResourceInputs, ResourceOutputs, TickIds, TravelTypes } from "../types";
import { scaleResourceInputs, scaleResourceOutputs, scaleResources } from "../utils";

import { EternumGlobalConfig as DefaultConfig, FELT_CENTER } from "../constants/global";

interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumGlobalConfig;
}

export class EternumConfig {
  public globalConfig: EternumGlobalConfig;

  constructor(config?: EternumGlobalConfig) {
    this.globalConfig = config || DefaultConfig;
  }

  async setup(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    // await setProductionConfig(config);
    await setQuestConfig(config);
    await setQuestRewardConfig(config);
    await setSeasonConfig(config);
    await setResourceBridgeWhitlelistConfig(config);
    await setResourceBridgeFeesConfig(config);
    await setBuildingCategoryPopConfig(config);
    await setPopulationConfig(config);
    await setBuildingConfig(config);
    await setResourceBuildingConfig(config);
    await setWeightConfig(config);
    await setBattleConfig(config);
    await setCombatConfig(config);
    await setRealmUpgradeConfig(config);
    await setRealmMaxLevelConfig(config);
    await setupGlobals(config);
    await setCapacityConfig(config);
    await setSpeedConfig(config);
    await setHyperstructureConfig(config);
    await setStaminaConfig(config);
    await setStaminaRefillConfig(config);
    await setMercenariesConfig(config);
    await setBuildingGeneralConfig(config);
    await setSettlementConfig(config);
  }

  async setupBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await createAdminBank(config);
    await mintResources(config);
    await addLiquidity(config);
  }

  getResourceBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.resources.resourceBuildingCosts,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getResourceOutputsScaled(): ResourceOutputs {
    return scaleResourceOutputs(
      this.globalConfig.resources.resourceOutputs,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.buildings.buildingCosts,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getResourceInputsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.resources.resourceInputs,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getHyperstructureConstructionCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureConstructionCosts,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getHyperstructureCreationCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureCreationCosts,
      this.globalConfig.resources.resourceMultiplier,
    );
  }

  getHyperstructureTotalCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureTotalCosts,
      this.globalConfig.resources.resourceMultiplier,
    );
  }
}

export const setQuestConfig = async (config: Config) => {
  const tx = await config.provider.set_quest_config({
    signer: config.account,
    production_material_multiplier: config.config.resources.startingResourcesInputProductionFactor,
  });

  console.log(`Configuring quest config ${tx.statusReceipt}...`);
};

export const setQuestRewardConfig = async (config: Config) => {
  const calldataArray = [];

  let QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(
    QUEST_RESOURCES,
    config.config.resources.resourceMultiplier * config.config.resources.resourcePrecision,
  );

  for (const questId of Object.keys(QUEST_RESOURCES_SCALED) as unknown as QuestType[]) {
    const calldata = {
      quest_id: questId,
      resources: QUEST_RESOURCES_SCALED[questId],
    };

    calldataArray.push(calldata);
  }
  const tx = await config.provider.set_quest_reward_config({ signer: config.account, calls: calldataArray });

  console.log(`Configuring quest reward ${tx.statusReceipt}...`);
};

export const setProductionConfig = async (config: Config) => {
  const calldataArray = [];

  for (const resourceId of Object.keys(
    scaleResourceInputs(config.config.resources.resourceInputs, config.config.resources.resourceMultiplier),
  ) as unknown as ResourcesIds[]) {
    const calldata = {
      amount: scaleResourceOutputs(config.config.resources.resourceOutputs, config.config.resources.resourceMultiplier)[
        resourceId
      ],
      resource_type: resourceId,
      cost: scaleResourceInputs(config.config.resources.resourceInputs, config.config.resources.resourceMultiplier)[
        resourceId
      ].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * config.config.resources.resourcePrecision,
        };
      }),
    };

    calldataArray.push(calldata);
  }

  const tx = await config.provider.set_production_config({ signer: config.account, calls: calldataArray });

  console.log(`Configuring resource production ${tx.statusReceipt}...`);
};

export const setBuildingCategoryPopConfig = async (config: Config) => {
  const calldataArray = [];

  const buildingPopulation = config.config.buildings.buildingPopulation;
  const buildingCapacity = config.config.buildings.buildingCapacity;

  for (const buildingId of Object.keys(buildingPopulation) as unknown as BuildingType[]) {
    // if both 0, tx will fail
    if (buildingPopulation[buildingId] !== 0 || buildingCapacity[buildingId] !== 0) {
      const callData = {
        building_category: buildingId,
        population: buildingPopulation[buildingId] ?? 0,
        capacity: buildingCapacity[buildingId] ?? 0,
      };

      calldataArray.push(callData);
    }
  }

  const tx = await config.provider.set_building_category_pop_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(`Configuring building category population ${tx.statusReceipt}...`);
};

export const setPopulationConfig = async (config: Config) => {
  const tx = await config.provider.set_population_config({
    signer: config.account,
    base_population: config.config.populationCapacity.basePopulation,
  });

  console.log(`Configuring population config ${tx.statusReceipt}...`);
};

export const setBuildingGeneralConfig = async (config: Config) => {
  const tx = await config.provider.set_building_general_config({
    signer: config.account,
    base_cost_percent_increase: config.config.buildings.buildingFixedCostScalePercent,
  });

  console.log(`Configuring building general config ${tx.statusReceipt}...`);
};

export const setBuildingConfig = async (config: Config) => {
  const calldataArray = [];

  const buildingResourceProduced = config.config.buildings.buildingResourceProduced;
  const buildingCosts = config.config.buildings.buildingCosts;

  for (const buildingId of Object.keys(buildingResourceProduced) as unknown as BuildingType[]) {
    if (scaleResourceInputs(buildingCosts, config.config.resources.resourceMultiplier)[buildingId].length !== 0) {
      const calldata = {
        building_category: buildingId,
        building_resource_type: buildingResourceProduced[buildingId] as ResourcesIds,
        cost_of_building: scaleResourceInputs(buildingCosts, config.config.resources.resourceMultiplier)[
          buildingId
        ].map((cost) => {
          return {
            ...cost,
            amount: cost.amount * config.config.resources.resourcePrecision,
          };
        }),
      };

      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_building_config({ signer: config.account, calls: calldataArray });

  console.log(`Configuring building cost config ${tx.statusReceipt}...`);
};

export const setRealmUpgradeConfig = async (config: Config) => {
  const calldataArray = [];

  const REALM_UPGRADE_COSTS_SCALED = scaleResourceInputs(
    config.config.realmUpgradeCosts,
    config.config.resources.resourceMultiplier,
  );

  for (const level of Object.keys(REALM_UPGRADE_COSTS_SCALED) as unknown as number[]) {
    if (REALM_UPGRADE_COSTS_SCALED[level].length !== 0) {
      const calldata = {
        level,
        cost_of_level: REALM_UPGRADE_COSTS_SCALED[level].map((cost) => {
          return {
            ...cost,
            amount: cost.amount * config.config.resources.resourcePrecision,
          };
        }),
      };

      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_realm_level_config({ signer: config.account, calls: calldataArray });
  console.log(`Configuring realm level cost config ${tx.statusReceipt}...`);
};

export const setRealmMaxLevelConfig = async (config: Config) => {
  const new_max_level = config.config.realmMaxLevel - 1;

  const tx = await config.provider.set_realm_max_level_config({
    signer: config.account,
    new_max_level,
  });
  console.log(`Configuring realm max level config ${tx.statusReceipt}...`);
};

export const setResourceBuildingConfig = async (config: Config) => {
  const calldataArray = [];

  const scaledBuildingCosts = scaleResourceInputs(
    config.config.resources.resourceBuildingCosts,
    config.config.resources.resourceMultiplier,
  );

  for (const resourceId of Object.keys(scaledBuildingCosts) as unknown as ResourcesIds[]) {
    const calldata = {
      building_category: BuildingType.Resource,
      building_resource_type: resourceId,
      cost_of_building: scaledBuildingCosts[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * config.config.resources.resourcePrecision,
        };
      }),
    };

    calldataArray.push(calldata);
  }

  const tx = await config.provider.set_building_config({ signer: config.account, calls: calldataArray });

  console.log(`Configuring resource building cost config ${tx.statusReceipt}...`);
};

export const setWeightConfig = async (config: Config) => {
  const calldataArray = Object.entries(config.config.resources.resourceWeightsGrams).map(([resourceId, weight]) => ({
    entity_type: resourceId,
    weight_gram: weight,
  }));

  const tx = await config.provider.set_weight_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(`Configuring weight config  ${tx.statusReceipt}...`);
};

export const setBattleConfig = async (config: Config) => {
  const { graceTickCount: battle_grace_tick_count, delaySeconds: battle_delay_seconds } = config.config.battle;

  const tx = await config.provider.set_battle_config({
    signer: config.account,
    config_id: 0,
    battle_grace_tick_count,
    battle_delay_seconds,
  });

  console.log(`Configuring battle config ${tx.statusReceipt}...`);
};

export const setCombatConfig = async (config: Config) => {
  const {
    health: health,
    knightStrength: knight_strength,
    paladinStrength: paladin_strength,
    crossbowmanStrength: crossbowman_strength,
    advantagePercent: advantage_percent,
    disadvantagePercent: disadvantage_percent,
    maxTroopCount: max_troop_count,
    pillageHealthDivisor: pillage_health_divisor,
    baseArmyNumberForStructure: army_free_per_structure,
    armyExtraPerMilitaryBuilding: army_extra_per_military_building,
    maxArmiesPerStructure: max_armies_per_structure,
    battleLeaveSlashNum: battle_leave_slash_num,
    battleLeaveSlashDenom: battle_leave_slash_denom,
    battleTimeReductionScale: battle_time_scale,
    battleMaxTimeSeconds: battle_max_time_seconds,
  } = config.config.troop;

  const tx = await config.provider.set_troop_config({
    signer: config.account,
    config_id: 0,
    health,
    knight_strength,
    paladin_strength,
    crossbowman_strength,
    advantage_percent,
    disadvantage_percent,
    max_troop_count: max_troop_count * config.config.resources.resourcePrecision,
    pillage_health_divisor: pillage_health_divisor,
    army_free_per_structure: army_free_per_structure,
    army_extra_per_military_building: army_extra_per_military_building,
    army_max_per_structure: max_armies_per_structure,
    battle_leave_slash_num,
    battle_leave_slash_denom,
    battle_time_scale,
    battle_max_time_seconds,
  });

  console.log(`Configuring combat config ${tx.statusReceipt}...`);
};

export const setupGlobals = async (config: Config) => {
  // Set the bank config
  const txBank = await config.provider.set_bank_config({
    signer: config.account,
    lords_cost: config.config.banks.lordsCost * config.config.resources.resourcePrecision,
    lp_fee_num: config.config.banks.lpFeesNumerator,
    lp_fee_denom: config.config.banks.lpFeesDenominator,
  });

  console.log(`Configuring bank config ${txBank.statusReceipt}...`);

  const txDefaultTick = await config.provider.set_tick_config({
    signer: config.account,
    tick_id: TickIds.Default,
    tick_interval_in_seconds: config.config.tick.defaultTickIntervalInSeconds,
  });
  console.log(`Configuring default tick config ${txDefaultTick.statusReceipt}...`);

  const txArmiesTick = await config.provider.set_tick_config({
    signer: config.account,
    tick_id: TickIds.Armies,
    tick_interval_in_seconds: config.config.tick.armiesTickIntervalInSeconds,
  });

  console.log(`Configuring army tick config ${txArmiesTick.statusReceipt}...`);

  const txMap = await config.provider.set_map_config({
    signer: config.account,
    config_id: 0,
    reward_amount: config.config.exploration.reward * config.config.resources.resourcePrecision,
    shards_mines_fail_probability: config.config.exploration.shardsMinesFailProbability,
  });
  console.log(`Configuring map config ${txMap.statusReceipt}...`);

  const txExploreStaminaCost = await config.provider.set_travel_stamina_cost_config({
    signer: config.account,
    travel_type: TravelTypes.Explore,
    cost: config.config.stamina.exploreCost,
  });
  console.log(`Configuring exploreStaminaCost config ${txExploreStaminaCost.statusReceipt}...`);

  const txTravelStaminaCost = await config.provider.set_travel_stamina_cost_config({
    signer: config.account,
    travel_type: TravelTypes.Travel,
    cost: config.config.stamina.travelCost,
  });

  console.log(`Configuring travel stamina cost config ${txTravelStaminaCost.statusReceipt}...`);

  for (const [unit_type, costs] of Object.entries(config.config.troop.troopFoodConsumption)) {
    const tx = await config.provider.set_travel_food_cost_config({
      signer: config.account,
      config_id: 0,
      unit_type: unit_type,
      explore_wheat_burn_amount: costs.explore_wheat_burn_amount * config.config.resources.resourcePrecision,
      explore_fish_burn_amount: costs.explore_fish_burn_amount * config.config.resources.resourcePrecision,
      travel_wheat_burn_amount: costs.travel_wheat_burn_amount * config.config.resources.resourcePrecision,
      travel_fish_burn_amount: costs.travel_fish_burn_amount * config.config.resources.resourcePrecision,
    });
    console.log(`Configuring travel costs for ${unit_type} ${tx.statusReceipt}...`);
  }
};

export const setCapacityConfig = async (config: Config) => {
  for (const [category, weight_gram] of Object.entries(config.config.carryCapacityGram)) {
    const tx = await config.provider.set_capacity_config({
      signer: config.account,
      category,
      weight_gram,
    });

    console.log(`Configuring capacity ${category} config ${tx.statusReceipt} max capacity: ${weight_gram}...`);
  }
};

export const setSeasonConfig = async (config: Config) => {
  const tx = await config.provider.set_season_config({
    signer: config.account,
    season_pass_address: config.config.season.seasonPassAddress,
    realms_address: config.config.season.realmsAddress,
    lords_address: config.config.season.lordsAddress,
  });

  console.log(`Configuring season config ${tx.statusReceipt}`);
};

export const setResourceBridgeWhitlelistConfig = async (config: Config) => {
  // allow bridging in of lords into the game
  const tx = await config.provider.set_resource_bridge_whitlelist_config({
    signer: config.account,
    token: config.config.season.lordsAddress,
    resource_type: ResourcesIds.Lords,
  });

  console.log(`Configuring whitelist for lords for in-game asset bridge ${tx.statusReceipt}`);
};

export const setResourceBridgeFeesConfig = async (config: Config) => {
  // allow bridging in of lords into the game
  const tx = await config.provider.set_resource_bridge_fees_config({
    signer: config.account,
    velords_fee_on_dpt_percent: config.config.bridge.velords_fee_on_dpt_percent,
    velords_fee_on_wtdr_percent: config.config.bridge.velords_fee_on_wtdr_percent,
    season_pool_fee_on_dpt_percent: config.config.bridge.season_pool_fee_on_dpt_percent,
    season_pool_fee_on_wtdr_percent: config.config.bridge.season_pool_fee_on_wtdr_percent,
    client_fee_on_dpt_percent: config.config.bridge.client_fee_on_dpt_percent,
    client_fee_on_wtdr_percent: config.config.bridge.client_fee_on_wtdr_percent,
    velords_fee_recipient: config.config.bridge.velords_fee_recipient,
    season_pool_fee_recipient: config.config.bridge.season_pool_fee_recipient,
    max_bank_fee_dpt_percent: config.config.bridge.max_bank_fee_dpt_percent,
    max_bank_fee_wtdr_percent: config.config.bridge.max_bank_fee_wtdr_percent,
  });

  console.log(`Configuring bridge fees ${tx.statusReceipt}`);
};

export const setSpeedConfig = async (config: Config) => {
  const txDonkey = await config.provider.set_speed_config({
    signer: config.account,
    entity_type: DONKEY_ENTITY_TYPE,
    sec_per_km: config.config.speed.donkey,
  });

  console.log(`Configuring speed Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await config.provider.set_speed_config({
    signer: config.account,
    entity_type: ARMY_ENTITY_TYPE,
    sec_per_km: config.config.speed.army,
  });

  console.log(`Configuring speed Army config ${txArmy.statusReceipt}...`);
};

export const setHyperstructureConfig = async (config: Config) => {
  const {
    hyperstructurePointsPerCycle,
    hyperstructurePointsOnCompletion,
    hyperstructureTimeBetweenSharesChangeSeconds,
    hyperstructurePointsForWin,
    hyperstructureTotalCosts,
  } = config.config.hyperstructures;

  const tx = await config.provider.set_hyperstructure_config({
    signer: config.account,
    resources_for_completion: scaleResources(hyperstructureTotalCosts, config.config.resources.resourceMultiplier).map(
      (resource) => ({
        ...resource,
        amount: resource.amount * config.config.resources.resourcePrecision,
      }),
    ),
    time_between_shares_change: hyperstructureTimeBetweenSharesChangeSeconds,
    points_per_cycle: hyperstructurePointsPerCycle,
    points_for_win: hyperstructurePointsForWin,
    points_on_completion: hyperstructurePointsOnCompletion,
  });
  console.log(`Configuring hyperstructure ${tx.statusReceipt}...`);
};

export const setStaminaConfig = async (config: Config) => {
  const { troopStaminas } = config.config.troop;

  for (const [unit_type, stamina] of Object.entries(troopStaminas)) {
    const tx = await config.provider.set_stamina_config({
      signer: config.account,
      unit_type: unit_type,
      max_stamina: stamina,
    });
    console.log(`Configuring staminas ${unit_type} ${tx.statusReceipt}...`);
  }
};

export const setStaminaRefillConfig = async (config: Config) => {
  const tx = await config.provider.set_stamina_refill_config({
    signer: config.account,
    amount_per_tick: config.config.stamina.refillPerTick,
    start_boost_tick_count: config.config.stamina.startBoostTickCount,
  });
  console.log(`Configuring stamina refill per tick to ${config.config.stamina.refillPerTick} ${tx.statusReceipt}...`);
};

export const setMercenariesConfig = async (config: Config) => {
  const tx = await config.provider.set_mercenaries_config({
    signer: config.account,
    knights_lower_bound: config.config.mercenaries.knights_lower_bound * config.config.resources.resourcePrecision,
    knights_upper_bound: config.config.mercenaries.knights_upper_bound * config.config.resources.resourcePrecision,
    paladins_lower_bound: config.config.mercenaries.paladins_lower_bound * config.config.resources.resourcePrecision,
    paladins_upper_bound: config.config.mercenaries.paladins_upper_bound * config.config.resources.resourcePrecision,
    crossbowmen_lower_bound:
      config.config.mercenaries.crossbowmen_lower_bound * config.config.resources.resourcePrecision,
    crossbowmen_upper_bound:
      config.config.mercenaries.crossbowmen_upper_bound * config.config.resources.resourcePrecision,
    rewards: config.config.mercenaries.rewards.map((reward) => ({
      resource: reward.resource,
      amount: reward.amount * config.config.resources.resourcePrecision * config.config.resources.resourceMultiplier,
    })),
  });
  console.log(`Configuring mercenaries ${tx.statusReceipt}...`);
};

export const setSettlementConfig = async (config: Config) => {
  const {
    radius,
    angle_scaled,
    center,
    min_distance,
    max_distance,
    min_scaling_factor_scaled,
    min_angle_increase,
    max_angle_increase,
  } = config.config.settlement;
  const tx = await config.provider.set_settlement_config({
    signer: config.account,
    radius,
    angle_scaled,
    center,
    min_distance,
    max_distance,
    min_scaling_factor_scaled,
    min_angle_increase,
    max_angle_increase,
  });
  console.log(`Configuring settlement ${tx.statusReceipt}...`);
};

export const createAdminBank = async (config: Config) => {
  const tx = await config.provider.create_admin_bank({
    signer: config.account,
    name: config.config.banks.name,
    coord: { x: FELT_CENTER, y: FELT_CENTER },
    owner_fee_num: config.config.banks.ownerFeesNumerator,
    owner_fee_denom: config.config.banks.ownerFeesDenominator,
    owner_bridge_fee_dpt_percent: config.config.banks.ownerBridgeFeeOnDepositPercent,
    owner_bridge_fee_wtdr_percent: config.config.banks.ownerBridgeFeeOnWithdrawalPercent,
  });
  console.log(`Creating admin bank ${tx.statusReceipt}...`);
};

export const mintResources = async (config: Config) => {
  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;
  const ammResourceIds = Object.keys(ammStartingLiquidity).map(Number);
  const totalResourceCount = ammResourceIds.length;
  // mint lords
  const lordsTx = await config.provider.mint_resources({
    signer: config.account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources: [
      ResourcesIds.Lords,
      config.config.resources.resourcePrecision * lordsLiquidityPerResource * totalResourceCount,
    ],
  });
  console.log(`Minting lords ${lordsTx.statusReceipt}...`);
  // mint all other resources
  const resources = ammResourceIds.flatMap((resourceId) => {
    return [
      resourceId,
      ammStartingLiquidity[resourceId as keyof typeof ammStartingLiquidity]! *
        config.config.resources.resourcePrecision,
    ];
  });
  const resourcesTx = await config.provider.mint_resources({
    signer: config.account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources,
  });
  console.log(`Minting resources ${resourcesTx.statusReceipt}...`);
};

export const addLiquidity = async (config: Config) => {
  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;

  let calls = [];

  for (const [resourceId, amount] of Object.entries(ammStartingLiquidity)) {
    calls.push({
      resource_type: resourceId,
      resource_amount: amount * config.config.resources.resourcePrecision,
      lords_amount: lordsLiquidityPerResource * config.config.resources.resourcePrecision,
    });

    console.log(
      `Adding liquidity for ${resourceId}: Lords ${
        lordsLiquidityPerResource * config.config.resources.resourcePrecision
      }, ` + `${resourceId} ${amount * config.config.resources.resourcePrecision}`,
    );
  }

  try {
    await config.provider.add_liquidity({
      signer: config.account,
      bank_entity_id: ADMIN_BANK_ENTITY_ID,
      entity_id: ADMIN_BANK_ENTITY_ID,
      calls,
    });
    console.log("Successfully added liquidity");
  } catch (e) {
    console.log(e);
  }
};
