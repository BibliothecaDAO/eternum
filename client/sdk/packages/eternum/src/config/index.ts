import { Account } from "starknet";
import { ADMIN_BANK_ENTITY_ID, ARMY_ENTITY_TYPE, DONKEY_ENTITY_TYPE, QuestType, ResourcesIds } from "../constants";
import { BuildingType } from "../constants/structures";
import { EternumProvider } from "../provider";
import { Config as EternumGlobalConfig, ResourceInputs, ResourceOutputs, ResourceWhitelistConfig, TickIds, TravelTypes } from "../types";
import { scaleResourceCostMinMax, scaleResourceInputs, scaleResourceOutputs, scaleResources } from "../utils";

import chalk from 'chalk';
import { EternumGlobalConfig as DefaultConfig, FELT_CENTER } from "../constants/global";
import { ResourceTier } from "../constants/resources";
interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumGlobalConfig;
}

const shortHexAddress = (address: string | undefined | null): string => {
  if (!address) return 'Not set';
  if (!address.startsWith('0x')) {
    address = BigInt(address).toString(16);
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const inGameAmount = (amount: number, config: EternumGlobalConfig) => {
  return amount / config.resources.resourcePrecision;
};

export class EternumConfig {
  public globalConfig: EternumGlobalConfig;

  constructor(config?: EternumGlobalConfig) {
    this.globalConfig = config || DefaultConfig;
  }

  async setup(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await setProductionConfig(config);
    await setResourceBridgeWhitelistConfig(config);
    await setQuestConfig(config);
    await setQuestRewardConfig(config);
    await setSeasonConfig(config);
    await setVRFConfig(config);
    await setResourceBridgeFeesConfig(config);
    await setBuildingCategoryPopConfig(config);
    await setPopulationConfig(config);
    await setBuildingConfig(config);
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
  console.log(chalk.cyan(`
  🎯 Quest System Configuration
  ═══════════════════════════════`));

  console.log(chalk.cyan(`
    Labor Resource Multiplier: ${chalk.yellow('×' + config.config.resources.startingResourcesInputProductionFactor)}`));

  const tx = await config.provider.set_quest_config({
    signer: config.account,
    production_material_multiplier: config.config.resources.startingResourcesInputProductionFactor,
  });

  console.log(chalk.gray(`    ⚡ Transaction: ${tx.statusReceipt}\n`));
};

export const setQuestRewardConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏆 Quest Rewards Configuration 
  ═══════════════════════════════`));

  const calldataArray = [];
  let QUEST_RESOURCES_SCALED = scaleResourceInputs(
    config.config.questResources,
    config.config.resources.resourceMultiplier * config.config.resources.resourcePrecision,
  );

  for (const questId of Object.keys(QUEST_RESOURCES_SCALED) as unknown as QuestType[]) {
    const resources = QUEST_RESOURCES_SCALED[questId];
    
    console.log(chalk.cyan(`
    ✧ Quest ${chalk.yellow(questId)} Rewards:`));
    
    resources.forEach(r => {
      console.log(chalk.cyan(`      ∙ ${chalk.cyan(inGameAmount(inGameAmount(r.amount, config.config), config.config))} ${chalk.yellow(ResourcesIds[r.resource])}`));
    });

    calldataArray.push({
      quest_id: questId,
      resources: resources,
    });
  }

  const tx = await config.provider.set_quest_reward_config({ 
    signer: config.account, 
    calls: calldataArray 
  });

  console.log(chalk.gray(`\n    ⚡ Transaction: ${tx.statusReceipt}\n`));
};

export const setProductionConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚡ RESOURCE PRODUCTION CONFIGURATION ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));

  const calldataArray = [];

  for (const resourceId of Object.keys(
    scaleResourceInputs(config.config.resources.resourceInputs, config.config.resources.resourceMultiplier),
  ) as unknown as ResourcesIds[]) {
    const outputAmount = scaleResourceOutputs(
      config.config.resources.resourceOutputs,
      config.config.resources.resourceMultiplier
    )[resourceId];
    
    const costs = scaleResourceInputs(
      config.config.resources.resourceInputs,
      config.config.resources.resourceMultiplier
    )[resourceId].map((cost) => ({
      ...cost,
      amount: cost.amount * config.config.resources.resourcePrecision,
    }));

    calldataArray.push({
      amount: outputAmount,
      resource_type: resourceId,
      cost: costs,
    });

    console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[resourceId])}
    │  ${chalk.gray('Production:')} ${chalk.white(`${inGameAmount(outputAmount, config.config)} per tick`)}
    │  ${chalk.gray('Requirements:')}${costs.map(c => `
    │     ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`)
       .join('')}
    └────────────────────────────────`));
  }

  const tx = await config.provider.set_production_config({ signer: config.account, calls: calldataArray });

  console.log(chalk.cyan(`
    ${chalk.green('✨ Configuration successfully deployed')}
    ${chalk.gray('Transaction:')} ${chalk.white(tx.statusReceipt)}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `));
};

export const setResourceBridgeWhitelistConfig = async (config: Config) => {
  console.log(chalk.cyan('\n⚡ BRIDGE WHITELIST CONFIGURATION'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  
  let resourceWhitelistConfigs: ResourceWhitelistConfig[] = [];
  for (const [resourceName, resourceData] of Object.entries(config.config.setup!.addresses.resources)) {
    const [resourceId, tokenAddress] = resourceData as unknown as [string, string];
    resourceWhitelistConfigs.push({
      token: tokenAddress,
      resource_type: resourceId,
    });
    console.log(
      chalk.yellow('     ➔ ') + 
      chalk.white(resourceName.padEnd(12)) +
      chalk.gray('[') + chalk.cyan(`#${resourceId}`.padEnd(4)) + chalk.gray(']') +
      chalk.gray(' ⟶  ') + 
      chalk.white(shortHexAddress(tokenAddress))
    );
  }

  const tx = await config.provider.set_resource_bridge_whitlelist_config({
    signer: config.account,
    resource_whitelist_configs: resourceWhitelistConfigs,
  });

  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.green('✔ ') + chalk.white('Configuration complete ') + chalk.gray(tx.statusReceipt) + '\n');
};


export const setBuildingCategoryPopConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  👥 Building Population Configuration
  ══════════════════════════════════`));

  const calldataArray = [];
  const buildingPopulation = config.config.buildings.buildingPopulation;
  const buildingCapacity = config.config.buildings.buildingCapacity;

  for (const buildingId of Object.keys(buildingPopulation) as unknown as BuildingType[]) {
    if (buildingPopulation[buildingId] !== 0 || buildingCapacity[buildingId] !== 0) {
      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[buildingId])}
    │  ${chalk.gray('Population:')} ${chalk.white(buildingPopulation[buildingId] ?? 0)}
    │  ${chalk.gray('Capacity:')} ${chalk.white(buildingCapacity[buildingId] ?? 0)}
    └────────────────────────────────`));

      calldataArray.push({
        building_category: buildingId,
        population: buildingPopulation[buildingId] ?? 0,
        capacity: buildingCapacity[buildingId] ?? 0,
      });
    }
  }

  const tx = await config.provider.set_building_category_pop_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setPopulationConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  👥 Population Configuration
  ══════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Base Parameters')}
    │  ${chalk.gray('Base Population:')}    ${chalk.white(config.config.populationCapacity.basePopulation)}
    └────────────────────────────────`));

  const tx = await config.provider.set_population_config({
    signer: config.account,
    base_population: config.config.populationCapacity.basePopulation,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setBuildingGeneralConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏗️  Building General Configuration
  ══════════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Cost Parameters')}
    │  ${chalk.gray('Base Cost Increase:')}    ${chalk.white(config.config.buildings.buildingFixedCostScalePercent + '%')}
    └────────────────────────────────`));

  const tx = await config.provider.set_building_general_config({
    signer: config.account,
    base_cost_percent_increase: config.config.buildings.buildingFixedCostScalePercent,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setBuildingConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏗️  Building Configuration
  ═══════════════════════════`));

  const calldataArray = [];
  const buildingResourceProduced = config.config.buildings.buildingResourceProduced;
  const buildingCosts = config.config.buildings.buildingCosts;

  for (const buildingId of Object.keys(buildingResourceProduced) as unknown as BuildingType[]) {
    if (scaleResourceInputs(buildingCosts, config.config.resources.resourceMultiplier)[buildingId].length !== 0) {
      const costs = scaleResourceInputs(buildingCosts, config.config.resources.resourceMultiplier)[buildingId];
      
      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[buildingId])}
    │  ${chalk.gray('Produces:')} ${chalk.white(ResourcesIds[buildingResourceProduced[buildingId] as ResourcesIds])}
    │  ${chalk.gray('Cost of making building:')}${costs.map(c => `
    │     ${chalk.white(`${inGameAmount(c.amount * config.config.resources.resourcePrecision, config.config)} ${ResourcesIds[c.resource]}`)}`)
       .join('')}
    └────────────────────────────────`));

      const calldata = {
        building_category: buildingId,
        building_resource_type: buildingResourceProduced[buildingId] as ResourcesIds,
        cost_of_building: costs.map((cost) => ({
          ...cost,
          amount: cost.amount * config.config.resources.resourcePrecision,
        })),
      };
      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_building_config({ signer: config.account, calls: calldataArray });
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setRealmUpgradeConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏰 Realm Upgrade Configuration
  ═══════════════════════════════`));

  const calldataArray = [];
  const REALM_UPGRADE_COSTS_SCALED = scaleResourceInputs(
    config.config.realmUpgradeCosts,
    config.config.resources.resourceMultiplier,
  );

  for (const level of Object.keys(REALM_UPGRADE_COSTS_SCALED) as unknown as number[]) {
    if (REALM_UPGRADE_COSTS_SCALED[level].length !== 0) {
      const costs = REALM_UPGRADE_COSTS_SCALED[level];
      
      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(`Level ${level}`)}
    │  ${chalk.gray('Upgrade Costs:')}${costs.map(c => `
    │     ${chalk.white(`${inGameAmount(c.amount * config.config.resources.resourcePrecision, config.config)} ${ResourcesIds[c.resource]}`)}`)
       .join('')}
    └────────────────────────────────`));

      const calldata = {
        level,
        cost_of_level: costs.map((cost) => ({
            ...cost,
            amount: cost.amount * config.config.resources.resourcePrecision,
          })),    
        };
      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_realm_level_config({ signer: config.account, calls: calldataArray });
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setRealmMaxLevelConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  👑 Realm Level Configuration
  ═══════════════════════════`));

  const new_max_level = config.config.realmMaxLevel - 1;

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Level Cap')}
    │  ${chalk.gray('Maximum Level:')}     ${chalk.white(new_max_level)}
    └────────────────────────────────`));

  const tx = await config.provider.set_realm_max_level_config({
    signer: config.account,
    new_max_level,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};


export const setWeightConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚖️  Resource Weight Configuration
  ═══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Resource Weights')}`));

  const calldataArray = Object.entries(config.config.resources.resourceWeightsGrams).map(([resourceId, weight]) => {
    console.log(chalk.cyan(`    │  ${chalk.gray(String(ResourcesIds[resourceId as keyof typeof ResourcesIds]).padEnd(12))} ${chalk.white(weight + ' grams')}`));
    return {
      entity_type: resourceId,
      weight_gram: weight,
    };
  });

  console.log(chalk.cyan(`    └────────────────────────────────`));

  const tx = await config.provider.set_weight_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setBattleConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚔️  Battle System Configuration
  ═══════════════════════════════`));

  const {
    graceTickCount: regular_immunity_ticks,
    graceTickCountHyp: hyperstructure_immunity_ticks,
    delaySeconds: battle_delay_seconds,
  } = config.config.battle;

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Battle Parameters')}
    │  ${chalk.gray('Regular Immunity:')}      ${chalk.white(regular_immunity_ticks + ' ticks')}
    │  ${chalk.gray('Structure Immunity:')}    ${chalk.white(hyperstructure_immunity_ticks + ' ticks')}
    │  ${chalk.gray('Battle Delay:')}          ${chalk.white(battle_delay_seconds + ' seconds')}
    └────────────────────────────────`));

  const tx = await config.provider.set_battle_config({
    signer: config.account,
    config_id: 0,
    regular_immunity_ticks,
    hyperstructure_immunity_ticks,
    battle_delay_seconds,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setCombatConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚔️  Combat System Configuration
  ═══════════════════════════════`));

  const {
    health,
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

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Stats')}
    │  ${chalk.gray('Base Health:')}          ${chalk.white(health)}
    │  ${chalk.gray('Knight Strength:')}      ${chalk.white(knight_strength)}
    │  ${chalk.gray('Paladin Strength:')}     ${chalk.white(paladin_strength)}
    │  ${chalk.gray('Crossbow Strength:')}    ${chalk.white(crossbowman_strength)}
    │
    │  ${chalk.yellow('Combat Modifiers')}
    │  ${chalk.gray('Advantage:')}            ${chalk.white(advantage_percent + '%')}
    │  ${chalk.gray('Disadvantage:')}         ${chalk.white(disadvantage_percent + '%')}
    │  ${chalk.gray('Max Troops:')}           ${chalk.white(inGameAmount(max_troop_count * config.config.resources.resourcePrecision, config.config))}
    │
    │  ${chalk.yellow('Army Parameters')}
    │  ${chalk.gray('Free per Structure:')}   ${chalk.white(army_free_per_structure)}
    │  ${chalk.gray('Extra per Military:')}   ${chalk.white(army_extra_per_military_building)}
    │  ${chalk.gray('Max per Structure:')}    ${chalk.white(max_armies_per_structure)}
    │
    │  ${chalk.yellow('Battle Mechanics')}
    │  ${chalk.gray('Pillage Divisor:')}      ${chalk.white(pillage_health_divisor)}
    │  ${chalk.gray('Leave Rate:')}           ${chalk.white(`${battle_leave_slash_num}/${battle_leave_slash_denom}`)}
    │  ${chalk.gray('Time Scale:')}           ${chalk.white(battle_time_scale)}
    │  ${chalk.gray('Max Duration:')}         ${chalk.white(battle_max_time_seconds + ' seconds')}
    └────────────────────────────────`));

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

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setupGlobals = async (config: Config) => {
  console.log(chalk.cyan(`
  🌍 Global Configuration
  ═══════════════════════`));

  // Bank Config
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Bank Parameters')}
    │  ${chalk.gray('LORDS Cost:')}        ${chalk.white(inGameAmount(config.config.banks.lordsCost, config.config))}
    │  ${chalk.gray('LP Fee Rate:')}       ${chalk.white(`${config.config.banks.lpFeesNumerator}/${config.config.banks.lpFeesDenominator}`)}
    └────────────────────────────────`));
  
  const txBank = await config.provider.set_bank_config({
    signer: config.account,
    lords_cost: config.config.banks.lordsCost * config.config.resources.resourcePrecision,
    lp_fee_num: config.config.banks.lpFeesNumerator,
    lp_fee_denom: config.config.banks.lpFeesDenominator,
  });
  console.log(chalk.green(`    ✔ Bank configured `) + chalk.gray(txBank.statusReceipt));

  // Tick Configs
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Tick Intervals')}
    │  ${chalk.gray('Default:')}           ${chalk.white(config.config.tick.defaultTickIntervalInSeconds + ' seconds')}
    │  ${chalk.gray('Armies:')}            ${chalk.white(config.config.tick.armiesTickIntervalInSeconds + ' seconds')}
    └────────────────────────────────`));

  const txDefaultTick = await config.provider.set_tick_config({
    signer: config.account,
    tick_id: TickIds.Default,
    tick_interval_in_seconds: config.config.tick.defaultTickIntervalInSeconds,
  });
  console.log(chalk.green(`    ✔ Tick intervals configured `) + chalk.gray(txDefaultTick.statusReceipt));

  const txArmiesTick = await config.provider.set_tick_config({
    signer: config.account,
    tick_id: TickIds.Armies,
    tick_interval_in_seconds: config.config.tick.armiesTickIntervalInSeconds,
  });

  console.log(chalk.green(`    ✔ Tick intervals configured `) + chalk.gray(txArmiesTick.statusReceipt));

  // Map Config
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Map Parameters')}
    │  ${chalk.gray('Exploration Reward:')} ${chalk.white(inGameAmount(config.config.exploration.reward, config.config))}
    │  ${chalk.gray('Mine Fail Rate:')}     ${chalk.white(config.config.exploration.shardsMinesFailProbability + '%')}
    └────────────────────────────────`));

  const txMap = await config.provider.set_map_config({
    signer: config.account,
    config_id: 0,
    reward_amount: config.config.exploration.reward * config.config.resources.resourcePrecision,
    shards_mines_fail_probability: config.config.exploration.shardsMinesFailProbability,
  });
  console.log(chalk.green(`    ✔ Map configured `) + chalk.gray(txMap.statusReceipt));

  // Stamina Costs
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Stamina Costs')}
    │  ${chalk.gray('Explore:')}           ${chalk.white(config.config.stamina.exploreCost)}
    │  ${chalk.gray('Travel:')}            ${chalk.white(config.config.stamina.travelCost)}
    └────────────────────────────────`));

  const txExploreStaminaCost = await config.provider.set_travel_stamina_cost_config({
    signer: config.account,
    travel_type: TravelTypes.Explore,
    cost: config.config.stamina.exploreCost,
  });
  console.log(chalk.green(`    ✔ Stamina costs configured `) + chalk.gray(txExploreStaminaCost.statusReceipt));

  const txTravelStaminaCost = await config.provider.set_travel_stamina_cost_config({
    signer: config.account,
    travel_type: TravelTypes.Travel,
    cost: config.config.stamina.travelCost,
  });

  console.log(chalk.green(`    ✔ Stamina costs configured `) + chalk.gray(txTravelStaminaCost.statusReceipt));

  // Food Consumption
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Food Consumption')}`));

  for (const [unit_type, costs] of Object.entries(config.config.troop.troopFoodConsumption)) {
    console.log(chalk.cyan(`    │  ${chalk.gray(unit_type)}
    │     ${chalk.gray('Explore:')}  ${chalk.white(`${inGameAmount(costs.explore_wheat_burn_amount, config.config)} wheat, ${inGameAmount(costs.explore_fish_burn_amount, config.config)} fish`)}
    │     ${chalk.gray('Travel:')}   ${chalk.white(`${inGameAmount(costs.travel_wheat_burn_amount, config.config)} wheat, ${inGameAmount(costs.travel_fish_burn_amount, config.config)} fish`)}`));

    const tx = await config.provider.set_travel_food_cost_config({
      signer: config.account,
      config_id: 0,
      unit_type: unit_type,
      explore_wheat_burn_amount: costs.explore_wheat_burn_amount * config.config.resources.resourcePrecision,
      explore_fish_burn_amount: costs.explore_fish_burn_amount * config.config.resources.resourcePrecision,
      travel_wheat_burn_amount: costs.travel_wheat_burn_amount * config.config.resources.resourcePrecision,
      travel_fish_burn_amount: costs.travel_fish_burn_amount * config.config.resources.resourcePrecision,
    });
    console.log(chalk.green(`    │  ✔ ${unit_type} configured `) + chalk.gray(tx.statusReceipt));
  }
  console.log(chalk.cyan(`    └────────────────────────────────`));
};

export const setCapacityConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  📦 Carry Capacity Configuration
  ═══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Category Weights')}${Object.entries(config.config.carryCapacityGram).map(([category, weight]) => `
    │  ${chalk.gray(category.padEnd(12))} ${chalk.white(weight.toString())} ${chalk.gray('grams')}`)
    .join('')}
    └────────────────────────────────`));

  for (const [category, weight_gram] of Object.entries(config.config.carryCapacityGram)) {
    const tx = await config.provider.set_capacity_config({
      signer: config.account,
      category,
      weight_gram,
    });
    console.log(chalk.green(`    ✔ ${category} configured `) + chalk.gray(tx.statusReceipt));
  }
  console.log();
};

export const setSeasonConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🎮 Season Configuration
  ═══════════════════════`));

  const now = Math.floor(new Date().getTime() / 1000);
  const startAt = now + config.config.season.startAfterSeconds;

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Season Parameters')}
    │  ${chalk.gray('Start Time:')}        ${chalk.white(new Date(startAt * 1000).toISOString())}
    │  ${chalk.gray('Bridge Close:')}      ${chalk.white(config.config.season.bridgeCloseAfterEndSeconds + ' seconds after end')}
    │
    │  ${chalk.yellow('Contract Addresses')}
    │  ${chalk.gray('Season Pass:')}       ${chalk.white(shortHexAddress(config.config.setup!.addresses.seasonPass))}
    │  ${chalk.gray('Realms:')}            ${chalk.white(shortHexAddress(config.config.setup!.addresses.realms))}
    │  ${chalk.gray('LORDS:')}             ${chalk.white(shortHexAddress(config.config.setup!.addresses.lords))}
    └────────────────────────────────`));

  const tx = await config.provider.set_season_config({
    signer: config.account,
    season_pass_address: config.config.setup!.addresses.seasonPass,
    realms_address: config.config.setup!.addresses.realms,
    lords_address: config.config.setup!.addresses.lords,
    start_at: startAt,
  });
  const txBridge = await config.provider.set_season_bridge_config({
    signer: config.account,
    close_after_end_seconds: config.config.season.bridgeCloseAfterEndSeconds,
  });

  console.log(chalk.green(`    ✔ Season configured `) + chalk.gray(tx.statusReceipt));
  console.log(chalk.green(`    ✔ Bridge configured `) + chalk.gray(txBridge.statusReceipt) + '\n');
};

export const setVRFConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🎲 VRF Configuration
  ═══════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('VRF Provider')}
    │  ${chalk.gray('Address:')}           ${chalk.white(shortHexAddress(config.config.vrf.vrfProviderAddress))}
    └────────────────────────────────`));

  const tx = await config.provider.set_vrf_config({
    signer: config.account,
    vrf_provider_address: config.config.vrf.vrfProviderAddress,
  });
  console.log(chalk.green(`    ✔ VRF configured `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setResourceBridgeFeesConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🌉 Bridge Fees Configuration
  ══════════════════════════`));

  const fees = {
    'veLORDS Deposit': config.config.bridge.velords_fee_on_dpt_percent + '%',
    'veLORDS Withdraw': config.config.bridge.velords_fee_on_wtdr_percent + '%',
    'Season Pool Deposit': config.config.bridge.season_pool_fee_on_dpt_percent + '%',
    'Season Pool Withdraw': config.config.bridge.season_pool_fee_on_wtdr_percent + '%',
    'Client Deposit': config.config.bridge.client_fee_on_dpt_percent + '%',
    'Client Withdraw': config.config.bridge.client_fee_on_wtdr_percent + '%',
    'Max Bank Deposit': config.config.bridge.max_bank_fee_dpt_percent + '%',
    'Max Bank Withdraw': config.config.bridge.max_bank_fee_wtdr_percent + '%'
  };

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Fee Structure')}${Object.entries(fees).map(([name, value]) => `
    │  ${chalk.gray(name.padEnd(20))} ${chalk.white(value)}`)
    .join('')}
    │
    │  ${chalk.yellow('Recipients')}
    │  ${chalk.gray('veLORDS:')}          ${chalk.white(shortHexAddress(config.config.bridge.velords_fee_recipient.toString()))}
    │  ${chalk.gray('Season Pool:')}      ${chalk.white(shortHexAddress(config.config.bridge.season_pool_fee_recipient.toString()))}
    └────────────────────────────────`));

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

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setSpeedConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏃 Movement Speed Configuration
  ════════════════════════════`));

  const speeds = [
    { type: 'Donkey', speed: config.config.speed.donkey },
    { type: 'Army', speed: config.config.speed.army }
  ];

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Travel Speeds')}${speeds.map(({type, speed}) => `
    │  ${chalk.gray(type.padEnd(8))} ${chalk.white(speed.toString())} ${chalk.gray('seconds/km')}`)
    .join('')}
    └────────────────────────────────`));

  for (const {type, speed} of speeds) {
    const tx = await config.provider.set_speed_config({
      signer: config.account,
      entity_type: type === 'Donkey' ? DONKEY_ENTITY_TYPE : ARMY_ENTITY_TYPE,
      sec_per_km: speed,
    });
    console.log(chalk.green(`    ✔ ${type} speed configured `) + chalk.gray(tx.statusReceipt));
  }
  console.log();
};

export const setHyperstructureConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏛️  Hyperstructure Configuration
  ═══════════════════════════════`));

  const {
    hyperstructurePointsPerCycle,
    hyperstructurePointsOnCompletion,
    hyperstructureTimeBetweenSharesChangeSeconds,
    hyperstructurePointsForWin,
    hyperstructureTotalCosts,
  } = config.config.hyperstructures;

  const costs = scaleResourceCostMinMax(
    hyperstructureTotalCosts,
    config.config.resources.resourceMultiplier,
  );

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Points System')}
    │  ${chalk.gray('Per Cycle:')}        ${chalk.white(hyperstructurePointsPerCycle)}
    │  ${chalk.gray('On Completion:')}    ${chalk.white(hyperstructurePointsOnCompletion)}
    │  ${chalk.gray('For Win:')}          ${chalk.white(hyperstructurePointsForWin)}
    │
    │  ${chalk.yellow('Timing')}
    │  ${chalk.gray('Share Change:')}     ${chalk.white(hyperstructureTimeBetweenSharesChangeSeconds + ' seconds')}
    │
    │  ${chalk.yellow('Resource Tier')}${costs.map(c => `
    │  ${chalk.gray(ResourceTier[c.resource_tier].padEnd(12))} ${chalk.white(inGameAmount(c.min_amount, config.config))} ${chalk.gray('to')} ${chalk.white(inGameAmount(c.max_amount, config.config))}`)
    .join('')}
    └────────────────────────────────`));
  const tx = await config.provider.set_hyperstructure_config({
    signer: config.account,
    resources_for_completion: costs.map((resource) => ({
      ...resource,
      min_amount: resource.min_amount * config.config.resources.resourcePrecision,
      max_amount: resource.max_amount * config.config.resources.resourcePrecision,
    })),
    time_between_shares_change: hyperstructureTimeBetweenSharesChangeSeconds,
    points_per_cycle: hyperstructurePointsPerCycle,
    points_for_win: hyperstructurePointsForWin,
    points_on_completion: hyperstructurePointsOnCompletion,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setStaminaConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚡ Stamina Configuration
  ═══════════════════════`));

  const { troopStaminas } = config.config.troop;

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Stamina Caps')}${Object.entries(troopStaminas).map(([unit, stamina]) => `
    │  ${chalk.gray(String(ResourcesIds[unit as keyof typeof ResourcesIds]).padEnd(12))} ${chalk.white(stamina)}`)
    .join('')}
    └────────────────────────────────`));

  for (const [unit_type, stamina] of Object.entries(troopStaminas)) {
    const tx = await config.provider.set_stamina_config({
      signer: config.account,
      unit_type: unit_type,
      max_stamina: stamina,
    });
    console.log(chalk.green(`    ✔ ${ResourcesIds[unit_type as keyof typeof ResourcesIds]} configured `) + chalk.gray(tx.statusReceipt));
  }
  console.log();
};

export const setStaminaRefillConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🔋 Stamina Refill Configuration
  ══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Refill Parameters')}
    │  ${chalk.gray('Amount per Tick:')}    ${chalk.white(config.config.stamina.refillPerTick)}
    │  ${chalk.gray('Boost Duration:')}     ${chalk.white(config.config.stamina.startBoostTickCount + ' ticks')}
    └────────────────────────────────`));

  const tx = await config.provider.set_stamina_refill_config({
    signer: config.account,
    amount_per_tick: config.config.stamina.refillPerTick,
    start_boost_tick_count: config.config.stamina.startBoostTickCount,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setMercenariesConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚔️  Mercenaries Configuration
  ═══════════════════════════════`));

  const bounds = {
    Knights: {
      lower: config.config.mercenaries.knights_lower_bound,
      upper: config.config.mercenaries.knights_upper_bound
    },
    Paladins: {
      lower: config.config.mercenaries.paladins_lower_bound,
      upper: config.config.mercenaries.paladins_upper_bound
    },
    Crossbowmen: {
      lower: config.config.mercenaries.crossbowmen_lower_bound,
      upper: config.config.mercenaries.crossbowmen_upper_bound
    }
  };

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Bounds')}${Object.entries(bounds).map(([unit, {lower, upper}]) => `
    │  ${chalk.gray(unit.padEnd(12))} ${chalk.white(lower.toString().padStart(4))} ${chalk.gray('to')} ${chalk.white(upper.toString().padStart(4))}`)
    .join('')}
    │
    │  ${chalk.yellow('Rewards:')}${config.config.mercenaries.rewards.map(r => `
    │     ${chalk.white(`${inGameAmount(r.amount, config.config)} ${ResourcesIds[r.resource]}`)}`)
    .join('')}
    └────────────────────────────────`));

  const tx = await config.provider.set_mercenaries_config({
    signer: config.account,
    knights_lower_bound: config.config.mercenaries.knights_lower_bound * config.config.resources.resourcePrecision,
    knights_upper_bound: config.config.mercenaries.knights_upper_bound * config.config.resources.resourcePrecision,
    paladins_lower_bound: config.config.mercenaries.paladins_lower_bound * config.config.resources.resourcePrecision,
    paladins_upper_bound: config.config.mercenaries.paladins_upper_bound * config.config.resources.resourcePrecision,
    crossbowmen_lower_bound: config.config.mercenaries.crossbowmen_lower_bound * config.config.resources.resourcePrecision,
    crossbowmen_upper_bound: config.config.mercenaries.crossbowmen_upper_bound * config.config.resources.resourcePrecision,
    rewards: config.config.mercenaries.rewards.map((reward) => ({
      resource: reward.resource,
      amount: reward.amount * config.config.resources.resourcePrecision * config.config.resources.resourceMultiplier,
    })),
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setSettlementConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏘️  Settlement Configuration
  ═══════════════════════════`));

  const {
    center,
    base_distance,
    min_first_layer_distance,
    points_placed,
    current_layer,
    current_side,
    current_point_on_side,
  } = config.config.settlement;

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Layout Parameters')}
    │  ${chalk.gray('Center:')}            ${chalk.white(`(${center}, ${center})`)}
    │  ${chalk.gray('Base Distance:')}     ${chalk.white(base_distance)}
    │  ${chalk.gray('Min First Layer:')}   ${chalk.white(min_first_layer_distance)}
    │
    │  ${chalk.yellow('Current State')}
    │  ${chalk.gray('Points Placed:')}     ${chalk.white(points_placed)}
    │  ${chalk.gray('Current Layer:')}     ${chalk.white(current_layer)}
    │  ${chalk.gray('Current Side:')}      ${chalk.white(current_side)}
    │  ${chalk.gray('Point on Side:')}     ${chalk.white(current_point_on_side)}
    └────────────────────────────────`));

  const tx = await config.provider.set_settlement_config({
    signer: config.account,
    center,
    base_distance,
    min_first_layer_distance,
    points_placed,
    current_layer,
    current_side,
    current_point_on_side,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const createAdminBank = async (config: Config) => {
  console.log(chalk.cyan(`
  🏦 Admin Bank Creation
  ═══════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Bank Parameters')}
    │  ${chalk.gray('Name:')}              ${chalk.white(config.config.banks.name)}
    │  ${chalk.gray('Location:')}          ${chalk.white(`(${FELT_CENTER}, ${FELT_CENTER})`)}
    │  ${chalk.gray('Owner Fee Rate:')}    ${chalk.white(`${config.config.banks.ownerFeesNumerator}/${config.config.banks.ownerFeesDenominator}`)}
    │  ${chalk.gray('Bridge Fee (In):')}   ${chalk.white(config.config.banks.ownerBridgeFeeOnDepositPercent + '%')}
    │  ${chalk.gray('Bridge Fee (Out):')}  ${chalk.white(config.config.banks.ownerBridgeFeeOnWithdrawalPercent + '%')}
    └────────────────────────────────`));

  const tx = await config.provider.create_admin_bank({
    signer: config.account,
    name: config.config.banks.name,
    coord: { x: FELT_CENTER, y: FELT_CENTER },
    owner_fee_num: config.config.banks.ownerFeesNumerator,
    owner_fee_denom: config.config.banks.ownerFeesDenominator,
    owner_bridge_fee_dpt_percent: config.config.banks.ownerBridgeFeeOnDepositPercent,
    owner_bridge_fee_wtdr_percent: config.config.banks.ownerBridgeFeeOnWithdrawalPercent,
  });

  console.log(chalk.green(`\n    ✔ Bank created successfully `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const mintResources = async (config: Config) => {
  console.log(chalk.cyan(`
  💰 Minting Initial Resources
  ══════════════════════════`));

  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;
  const ammResourceIds = Object.keys(ammStartingLiquidity).map(Number);
  const totalResourceCount = ammResourceIds.length;

  // Mint LORDS
  const lordsAmount = config.config.resources.resourcePrecision * lordsLiquidityPerResource * totalResourceCount;
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Minting LORDS')}
    │  ${chalk.gray('Amount:')} ${chalk.white(inGameAmount(lordsAmount, config.config))}
    │  ${chalk.gray('To:')} ${chalk.white(`Bank #${ADMIN_BANK_ENTITY_ID}`)}
    └────────────────────────────────`));

  await config.provider.mint_resources({
    signer: config.account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources: [ResourcesIds.Lords, lordsAmount],
  });

  // Mint other resources
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Minting Resources')}`));

  const resources = ammResourceIds.flatMap((resourceId) => {
    const amount = ammStartingLiquidity[resourceId as keyof typeof ammStartingLiquidity]! * 
      config.config.resources.resourcePrecision;
    console.log(chalk.cyan(`    │  ${chalk.gray(ResourcesIds[resourceId].padEnd(12))} ${chalk.white(inGameAmount(amount, config.config))}`));
    return [resourceId, amount];
  });

  console.log(chalk.cyan(`    └────────────────────────────────`));

  await config.provider.mint_resources({
    signer: config.account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources,
  });

  console.log(chalk.green(`\n    ✔ Resources minted successfully\n`));
};

export const addLiquidity = async (config: Config) => {
  console.log(chalk.cyan(`
  💧 Adding Initial Liquidity
  ══════════════════════════`));

  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;
  let calls = [];

  for (const [resourceId, amount] of Object.entries(ammStartingLiquidity)) {
    const resourceAmount = amount * config.config.resources.resourcePrecision;
    const lordsAmount = lordsLiquidityPerResource * config.config.resources.resourcePrecision;

    console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[resourceId as keyof typeof ResourcesIds])} Pool
    │  ${chalk.gray('Resource Amount:')} ${chalk.white(inGameAmount(resourceAmount, config.config))}
    │  ${chalk.gray('LORDS Amount:')}    ${chalk.white(inGameAmount(lordsAmount, config.config))}
    └────────────────────────────────`));

    calls.push({
      resource_type: resourceId,
      resource_amount: resourceAmount,
      lords_amount: lordsAmount,
    });
  }

  try {
    const tx = await config.provider.add_liquidity({
      signer: config.account,
      bank_entity_id: ADMIN_BANK_ENTITY_ID,
      entity_id: ADMIN_BANK_ENTITY_ID,
      calls,
    });
    console.log(chalk.green(`\n    ✔ Liquidity added successfully `) + chalk.gray(tx.statusReceipt) + '\n');
  } catch (e) {
    console.log(chalk.red(`\n    ✖ Failed to add liquidity: `) + chalk.gray(e) + '\n');
  }
};
