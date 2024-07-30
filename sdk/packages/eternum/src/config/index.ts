import { Account } from "starknet";
import {
  ARMY_ENTITY_TYPE,
  BASE_POPULATION_CAPACITY,
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  DONKEY_ENTITY_TYPE,
  EternumGlobalConfig,
  HYPERSTRUCTURE_TIME_BETWEEN_SHARES_CHANGE,
  ResourcesIds,
  TROOPS_STAMINAS,
  WEIGHTS,
} from "../constants";
import { BuildingType } from "../constants/structures";
import { EternumProvider } from "../provider";
import { TickIds } from "../types";
import {
  BUILDING_COSTS_SCALED,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  RESOURCE_BUILDING_COSTS_SCALED,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
} from "../utils";

// Function to configure all resources
export const setProductionConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = [];

  for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
    const calldata = {
      amount: RESOURCE_OUTPUTS_SCALED[resourceId],
      resource_type: resourceId,
      cost: RESOURCE_INPUTS_SCALED[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount,
        };
      }),
    };

    calldataArray.push(calldata);
  }

  const tx = await provider.set_production_config({ signer: account, calls: calldataArray });

  console.log(`Configuring resource production ${tx.statusReceipt}...`);
};

export const setBuildingCategoryPopConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = [];

  for (const buildingId of Object.keys(BUILDING_POPULATION) as unknown as BuildingType[]) {
    // if both 0, tx will fail
    if (BUILDING_POPULATION[buildingId] !== 0 || BUILDING_CAPACITY[buildingId] !== 0) {
      const callData = {
        building_category: buildingId,
        population: BUILDING_POPULATION[buildingId],
        capacity: BUILDING_CAPACITY[buildingId],
      };

      calldataArray.push(callData);
    }
  }

  const tx = await provider.set_building_category_pop_config({
    signer: account,
    calls: calldataArray,
  });

  console.log(`Configuring building category population ${tx.statusReceipt}...`);
};

export const setPopulationConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_population_config({
    signer: account,
    base_population: BASE_POPULATION_CAPACITY,
  });

  console.log(`Configuring population config ${tx.statusReceipt}...`);
};

export const setBuildingConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = [];

  for (const buildingId of Object.keys(BUILDING_RESOURCE_PRODUCED) as unknown as BuildingType[]) {
    if (BUILDING_COSTS_SCALED[buildingId].length !== 0) {
      const calldata = {
        building_category: buildingId,
        building_resource_type: BUILDING_RESOURCE_PRODUCED[buildingId],
        cost_of_building: BUILDING_COSTS_SCALED[buildingId].map((cost) => {
          return {
            ...cost,
            amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
          };
        }),
      };

      calldataArray.push(calldata);
    }
  }

  const tx = await provider.set_building_config({ signer: account, calls: calldataArray });

  console.log(`Configuring building cost config ${tx.statusReceipt}...`);
};

export const setResourceBuildingConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = [];

  for (const resourceId of Object.keys(RESOURCE_BUILDING_COSTS_SCALED) as unknown as ResourcesIds[]) {
    const calldata = {
      building_category: BuildingType.Resource,
      building_resource_type: resourceId,
      cost_of_building: RESOURCE_BUILDING_COSTS_SCALED[resourceId].map((cost) => {
        return {
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
        };
      }),
    };

    calldataArray.push(calldata);
  }

  const tx = await provider.set_building_config({ signer: account, calls: calldataArray });

  console.log(`Configuring resource building cost config ${tx.statusReceipt}...`);
};

export const setWeightConfig = async (account: Account, provider: EternumProvider) => {
  const calldataArray = Object.entries(WEIGHTS).map(([resourceId, weight]) => ({
    entity_type: resourceId,
    weight_gram: weight * EternumGlobalConfig.resources.resourceMultiplier,
  }));

  const tx = await provider.set_weight_config({
    signer: account,
    calls: calldataArray,
  });

  console.log(`Configuring weight config  ${tx.statusReceipt}...`);
};

export const setCombatConfig = async (account: Account, provider: EternumProvider) => {
  const {
    health: health,
    knightStrength: knight_strength,
    paladinStrength: paladin_strength,
    crossbowmanStrength: crossbowman_strength,
    advantagePercent: advantage_percent,
    disadvantagePercent: disadvantage_percent,
    pillageHealthDivisor: pillage_health_divisor,
    baseArmyNumberForStructure: army_free_per_structure,
    armyExtraPerMilitaryBuilding: army_extra_per_military_building,
  } = EternumGlobalConfig.troop;

  const tx = await provider.set_troop_config({
    signer: account,
    config_id: 0,
    health,
    knight_strength,
    paladin_strength,
    crossbowman_strength,
    advantage_percent,
    disadvantage_percent,
    pillage_health_divisor: pillage_health_divisor,
    army_free_per_structure: army_free_per_structure,
    army_extra_per_military_building: army_extra_per_military_building,
  });

  console.log(`Configuring combat config ${tx.statusReceipt}...`);
};

export const setupGlobals = async (account: Account, provider: EternumProvider) => {
  // Set the bank config
  const txBank = await provider.set_bank_config({
    signer: account,
    lords_cost: EternumGlobalConfig.banks.lordsCost * EternumGlobalConfig.resources.resourcePrecision,
    lp_fee_num: EternumGlobalConfig.banks.lpFeesNumerator,
    lp_fee_denom: EternumGlobalConfig.banks.lpFeesDenominator,
  });

  console.log(`Configuring bank config ${txBank.statusReceipt}...`);

  const txDefaultTick = await provider.set_tick_config({
    signer: account,
    tick_id: TickIds.Default,
    tick_interval_in_seconds: EternumGlobalConfig.tick.defaultTickIntervalInSeconds,
  });
  console.log(`Configuring tick config ${txDefaultTick.statusReceipt}...`);

  const txArmiesTick = await provider.set_tick_config({
    signer: account,
    tick_id: TickIds.Armies,
    tick_interval_in_seconds: EternumGlobalConfig.tick.armiesTickIntervalInSeconds,
  });

  console.log(`Configuring tick config ${txArmiesTick.statusReceipt}...`);

  const txExplore = await provider.set_exploration_config({
    signer: account,
    wheat_burn_amount: EternumGlobalConfig.exploration.wheatBurn * EternumGlobalConfig.resources.resourcePrecision,
    fish_burn_amount: EternumGlobalConfig.exploration.fishBurn * EternumGlobalConfig.resources.resourcePrecision,
    reward_amount: EternumGlobalConfig.exploration.reward * EternumGlobalConfig.resources.resourcePrecision,
    shards_mines_fail_probability: EternumGlobalConfig.exploration.shardsMinesFailProbability,
  });

  console.log(`Configuring exploration config ${txExplore.statusReceipt}...`);
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

export const setHyperstructureConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_hyperstructure_config({
    signer: account,
    time_between_shares_change: HYPERSTRUCTURE_TIME_BETWEEN_SHARES_CHANGE,
    resources_for_completion: HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map((resource) => ({
      ...resource,
      amount: resource.amount * EternumGlobalConfig.resources.resourcePrecision,
    })),
  });
  console.log(`Configuring hyperstructure ${tx.statusReceipt}...`);
};

export const setStaminaConfig = async (account: Account, provider: EternumProvider) => {
  for (const [unit_type, stamina] of Object.entries(TROOPS_STAMINAS)) {
    const tx = await provider.set_stamina_config({
      signer: account,
      unit_type: unit_type,
      max_stamina: stamina,
    });
    console.log(`Configuring staminas ${unit_type} ${tx.statusReceipt}...`);
  }
};

export const setMercenariesConfig = async (account: Account, provider: EternumProvider) => {
  const tx = await provider.set_mercenaries_config({
    signer: account,
    troops: {
      knight_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.knight_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
      paladin_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.paladin_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
      crossbowman_count:
        BigInt(EternumGlobalConfig.mercenaries.troops.crossbowman_count) *
        BigInt(EternumGlobalConfig.resources.resourcePrecision),
    },
    rewards: EternumGlobalConfig.mercenaries.rewards.map((reward) => ({
      resource: reward.resource,
      amount:
        reward.amount *
        EternumGlobalConfig.resources.resourcePrecision *
        EternumGlobalConfig.resources.resourceMultiplier,
    })),
  });
  console.log(`Configuring mercenaries ${tx.statusReceipt}...`);
};
