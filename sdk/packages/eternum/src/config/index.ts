import { Account } from "starknet";
import {
  ARMY_ENTITY_TYPE,
  BUILDING_CAPACITY,
  BUILDING_COSTS,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  DONKEY_ENTITY_TYPE,
  EternumGlobalConfig,
  QuestResources,
  QuestType,
  RESOURCE_BUILDING_COSTS,
  RESOURCE_INPUTS,
  RESOURCE_OUTPUTS,
  ResourcesIds,
  WeightConfig,
} from "../constants";
import { EternumProvider } from "../provider";
import { BuildingType } from "../utils";

// Function to configure all resources
export const setProductionConfig = async (account: Account, provider: EternumProvider) => {
  for (const resourceId of Object.keys(RESOURCE_INPUTS) as unknown as ResourcesIds[]) {
    const tx = await provider.set_production_config({
      signer: account,
      amount: RESOURCE_OUTPUTS[resourceId] * 1000,
      resource_type: resourceId,
      cost: RESOURCE_INPUTS[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * 1000,
        };
      }),
    });

    console.log(`Configuring resource production ${resourceId} ${tx.statusReceipt}...`);
  }
};

export const setPopulationConfig = async (account: Account, provider: EternumProvider) => {
  for (const buildingId of Object.keys(BUILDING_POPULATION) as unknown as BuildingType[]) {
    const tx = await provider.set_population_config({
      signer: account,
      building_category: buildingId,
      population: BUILDING_POPULATION[buildingId],
      capacity: BUILDING_CAPACITY[buildingId],
    });

    console.log(`Configuring building population ${buildingId} ${tx.statusReceipt}...`);
  }
};

export const setBuildingConfig = async (account: Account, provider: EternumProvider) => {
  for (const buildingId of Object.keys(BUILDING_RESOURCE_PRODUCED) as unknown as BuildingType[]) {
    const tx = await provider.set_building_config({
      signer: account,
      building_category: buildingId,
      building_resource_type: BUILDING_RESOURCE_PRODUCED[buildingId],
      cost_of_building: BUILDING_COSTS[buildingId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision * 1000,
        };
      }),
    });

    console.log(`Configuring building cost config ${buildingId} ${tx.statusReceipt}...`);
  }
};

export const setResourceBuildingConfig = async (account: Account, provider: EternumProvider) => {
  for (const resourceId of Object.keys(RESOURCE_BUILDING_COSTS) as unknown as ResourcesIds[]) {
    const tx = await provider.set_building_config({
      signer: account,
      building_category: BuildingType.Resource,
      building_resource_type: resourceId,
      cost_of_building: RESOURCE_BUILDING_COSTS[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision * 1000,
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
    lords_cost: EternumGlobalConfig.resources.resourcePrecision * EternumGlobalConfig.banks.lordsCost * 1000,
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
    wheat_burn_amount:
      EternumGlobalConfig.exploration.wheatBurn * EternumGlobalConfig.resources.resourcePrecision * 1000,
    fish_burn_amount: EternumGlobalConfig.exploration.fishBurn * EternumGlobalConfig.resources.resourcePrecision * 1000,
    reward_amount: EternumGlobalConfig.exploration.reward * EternumGlobalConfig.resources.resourcePrecision * 1000,
  });

  console.log(`Configuring bank config ${txExplore.statusReceipt}...`);
};

export const setCapacityConfig = async (account: Account, provider: EternumProvider) => {
  const txDonkey = await provider.set_capacity_config({
    signer: account,
    entity_type: DONKEY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacity.donkey,
  });

  console.log(`Configuring capacity Donkey config ${txDonkey.statusReceipt}...`);

  const txArmy = await provider.set_capacity_config({
    signer: account,
    entity_type: ARMY_ENTITY_TYPE,
    weight_gram: EternumGlobalConfig.carryCapacity.army,
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
  for (const type of Object.keys(QuestResources) as unknown as QuestType[]) {
    const tx = await provider.set_mint_config({
      signer: account,
      config_id: type,
      resources: QuestResources[type].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision * 1000,
        };
      }),
    });

    console.log(`Configuring quest config ${type} ${tx.statusReceipt}...`);
  }
};
