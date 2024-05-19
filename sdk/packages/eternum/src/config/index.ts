import { Account } from "starknet";
import {
  ARMY_ENTITY_TYPE,
  BASE_POPULATION_CAPACITY,
  BUILDING_CAPACITY,
  BUILDING_COSTS_SCALED,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  DONKEY_ENTITY_TYPE,
  EternumGlobalConfig,
  QUEST_RESOURCES_SCALED,
  QuestType,
  RESOURCE_BUILDING_COSTS_SCALED,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  WeightConfig,
} from "../constants";
import { EternumProvider } from "../provider";
import { BuildingType } from "../utils";

// Function to configure all resources
export const setProductionConfig = async (account: Account, provider: EternumProvider) => {
  for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
    const tx = await provider.set_production_config({
      signer: account,
      amount: RESOURCE_OUTPUTS_SCALED[resourceId],
      resource_type: resourceId,
      cost: RESOURCE_INPUTS_SCALED[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount,
        };
      }),
    });

    console.log(`Configuring resource production ${resourceId} ${tx.statusReceipt}...`);
  }
};

export const setBuildingCategoryPopConfig = async (account: Account, provider: EternumProvider) => {
  for (const buildingId of Object.keys(BUILDING_POPULATION) as unknown as BuildingType[]) {
    const tx = await provider.set_building_category_pop_config({
      signer: account,
      building_category: buildingId,
      population: BUILDING_POPULATION[buildingId],
      capacity: BUILDING_CAPACITY[buildingId],
    });

    console.log(`Configuring building category population ${buildingId} ${tx.statusReceipt}...`);
  }
};

export const setPopulationConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_population_config({
    signer: account,
    base_population: BASE_POPULATION_CAPACITY,
  });

  console.log(`Configuring population config ${tx.statusReceipt}...`);
};

export const setBuildingConfig = async (account: Account, provider: EternumProvider) => {
  for (const buildingId of Object.keys(BUILDING_RESOURCE_PRODUCED) as unknown as BuildingType[]) {
    const tx = await provider.set_building_config({
      signer: account,
      building_category: buildingId,
      building_resource_type: BUILDING_RESOURCE_PRODUCED[buildingId],
      cost_of_building: BUILDING_COSTS_SCALED[buildingId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
        };
      }),
    });

    console.log(`Configuring building cost config ${buildingId} ${tx.statusReceipt}...`);
  }
};

export const setResourceBuildingConfig = async (account: Account, provider: EternumProvider) => {
  for (const resourceId of Object.keys(RESOURCE_BUILDING_COSTS_SCALED) as unknown as ResourcesIds[]) {
    const tx = await provider.set_building_config({
      signer: account,
      building_category: BuildingType.Resource,
      building_resource_type: resourceId,
      cost_of_building: RESOURCE_BUILDING_COSTS_SCALED[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
        };
      }),
    });

    console.log(`Configuring resource building cost config ${resourceId} ${tx.statusReceipt}...`);
  }
};

export const setWeightConfig = async (account: Account, provider: EternumProvider) => {
  for (const resourceId of Object.keys(WeightConfig) as unknown as ResourcesIds[]) {
    const tx = await provider.set_weight_config({
      signer: account,
      entity_type: resourceId,
      weight_gram: WeightConfig[resourceId],
    });

    console.log(`Configuring weight config ${resourceId} ${tx.statusReceipt}...`);
  }
};

export const setCombatConfig = async (account: Account, provider: EternumProvider) => {
  const {
    knightHealth: knight_health,
    paladinHealth: paladin_health,
    crossbowmanHealth: crossbowman_health,
    knightStrength: knight_strength,
    paladinStrength: paladin_strength,
    crossbowmanStrength: crossbowman_strength,
    advantagePercent: advantage_percent,
    disadvantagePercent: disadvantage_percent,
  } = EternumGlobalConfig.troop;

  const tx = await provider.set_troop_config({
    signer: account,
    config_id: 0,
    knight_health,
    paladin_health,
    crossbowman_health,
    knight_strength,
    paladin_strength,
    crossbowman_strength,
    advantage_percent,
    disadvantage_percent,
  });

  console.log(`Configuring combat config ${tx.statusReceipt}...`);
};

export const setupGlobals = async (account: Account, provider: EternumProvider) => {
  // Set the bank config
  const txBank = await provider.set_bank_config({
    signer: account,
    lords_cost: EternumGlobalConfig.banks.lordsCost * EternumGlobalConfig.resources.resourcePrecision,
    lp_fee_scaled: EternumGlobalConfig.banks.lpFees,
  });

  console.log(`Configuring bank config ${txBank.statusReceipt}...`);

  const txTick = await provider.set_tick_config({
    signer: account,
    max_moves_per_tick: EternumGlobalConfig.tick.movesPerTick,
    tick_interval_in_seconds: EternumGlobalConfig.tick.tickIntervalInSeconds,
  });

  console.log(`Configuring bank config ${txTick.statusReceipt}...`);

  const txExplore = await provider.set_explore_config({
    signer: account,
    wheat_burn_amount: EternumGlobalConfig.exploration.wheatBurn * EternumGlobalConfig.resources.resourcePrecision,
    fish_burn_amount: EternumGlobalConfig.exploration.fishBurn * EternumGlobalConfig.resources.resourcePrecision,
    reward_amount: EternumGlobalConfig.exploration.reward * EternumGlobalConfig.resources.resourcePrecision,
  });

  console.log(`Configuring bank config ${txExplore.statusReceipt}...`);
};

export const setCapacityConfig = async (account: Account, provider: EternumProvider) => {
  const txDonkey = await provider.set_capacity_config({
    signer: account,
    entity_type: DONKEY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacity.donkey * EternumGlobalConfig.resources.resourcePrecision,
  });

  console.log(`Configuring capacity Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await provider.set_capacity_config({
    signer: account,
    entity_type: ARMY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacity.army * EternumGlobalConfig.resources.resourcePrecision,
  });

  console.log(`Configuring capacity Army config ${txArmy.statusReceipt}...`);
};

export const setSpeedConfig = async (account: Account, provider: EternumProvider) => {
  const txDonkey = await provider.set_speed_config({
    signer: account,
    entity_type: DONKEY_ENTITY_TYPE,
    sec_per_km: EternumGlobalConfig.speed.donkey,
  });

  console.log(`Configuring speed Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await provider.set_speed_config({
    signer: account,
    entity_type: ARMY_ENTITY_TYPE,
    sec_per_km: EternumGlobalConfig.speed.army,
  });

  console.log(`Configuring speed Army config ${txArmy.statusReceipt}...`);
};

export const setQuestConfig = async (account: Account, provider: EternumProvider) => {
  for (const type of Object.keys(QUEST_RESOURCES_SCALED) as unknown as QuestType[]) {
    const tx = await provider.set_mint_config({
      signer: account,
      config_id: type,
      resources: QUEST_RESOURCES_SCALED[type].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
        };
      }),
    });

    console.log(`Configuring quest config ${type} ${tx.statusReceipt}...`);
  }
};
