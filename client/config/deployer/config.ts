import {
  ADMIN_BANK_ENTITY_ID, ARMY_ENTITY_TYPE,
  BRIDGE_FEE_DENOMINATOR,
  BuildingType, CapacityConfigCategory,
  EternumGlobalConfig as DefaultConfig,
  DONKEY_ENTITY_TYPE,
  EternumProvider,
  FELT_CENTER,
  QuestType, ResourcesIds,
  ResourceTier,
  scaleResourceCostMinMax, scaleResourceInputs, scaleResourceOutputs, scaleResources,
  SHARDS_MINES_WIN_PROBABILITY,
  TickIds,
  TravelTypes,
  type Config as EternumGlobalConfig, type ResourceInputs, type ResourceOutputs, type ResourceWhitelistConfig,
} from "@bibliothecadao/eternum";
import { Account } from "starknet";

import chalk from 'chalk';
import { addCommas, hourMinutesSeconds, inGameAmount, shortHexAddress } from "../utils/formatting";

interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumGlobalConfig;
}


export class GameConfigDeployer {
  public globalConfig: EternumGlobalConfig;

  constructor(config?: EternumGlobalConfig) {
    this.globalConfig = config || DefaultConfig;
  }


  async setupAll(account: Account, provider: EternumProvider) {
    await this.setupNonBank(account, provider);
    await this.setupBank(account, provider);
  }

  async setupNonBank(account: Account, provider: EternumProvider) {
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
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getResourceOutputsScaled(): ResourceOutputs {
    return scaleResourceOutputs(
      this.globalConfig.resources.resourceOutputs,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.buildings.buildingCosts,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getResourceInputsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.resources.resourceInputs,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getHyperstructureConstructionCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureConstructionCosts,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getHyperstructureCreationCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureCreationCosts,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getHyperstructureTotalCostsScaled(): { resource: number; amount: number }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureTotalCosts,
      this.globalConfig.resources.resourcePrecision,
    );
  }
}

export const setQuestConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🎯 Quest System Configuration
  ═══════════════════════════════`));

  const calldata = {
    signer: config.account,
    production_material_multiplier: config.config.resources.startingResourcesInputProductionFactor,
  }

  console.log(chalk.cyan(`
    Labor Resource Multiplier: ${chalk.yellow('×' + calldata.production_material_multiplier)}`));

  const tx = await config.provider.set_quest_config(calldata);
  console.log(chalk.gray(`    ⚡ Transaction: ${tx.statusReceipt}\n`));
};

export const setQuestRewardConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏆 Quest Rewards Configuration 
  ═══════════════════════════════`));

  const calldataArray = [];
  let scaledQuestResources = scaleResourceInputs(
    config.config.questResources,
    config.config.resources.resourcePrecision,
  );

  for (const questId of Object.keys(scaledQuestResources) as unknown as QuestType[]) {
    const resources = scaledQuestResources[questId];
    const calldata = {
      quest_id: questId,
      resources: resources,
    }
    
    console.log(chalk.cyan(`
    ✧ Quest ${chalk.yellow(calldata.quest_id)} Rewards:`));
    
    calldata.resources.forEach(r => {
      console.log(chalk.cyan(`      ∙ ${chalk.cyan(inGameAmount(r.amount, config.config))} ${chalk.yellow(ResourcesIds[r.resource])}`));
    });

    calldataArray.push(calldata);
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
  const scaledResourceInputs = scaleResourceInputs(config.config.resources.resourceInputs, config.config.resources.resourcePrecision);
  const scaledResourceOutputs = scaleResourceOutputs(config.config.resources.resourceOutputs, config.config.resources.resourcePrecision);

  for (const resourceId of Object.keys(scaledResourceInputs) as unknown as ResourcesIds[]) {
    const outputAmountPerLabor = scaledResourceOutputs[resourceId];
    const resourceCostPerLabor = scaledResourceInputs[resourceId];
    const calldata = {
      amount: outputAmountPerLabor,
      resource_type: resourceId,
      cost: resourceCostPerLabor,
    }
    calldataArray.push(calldata);

    console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[calldata.resource_type])}
    │  ${chalk.gray(`${ResourcesIds[calldata.resource_type]} produced per labor:`)} ${chalk.white(`${inGameAmount(calldata.amount, config.config)} ${chalk.yellow(ResourcesIds[calldata.resource_type])}`)}
    │  ${chalk.gray(`Cost of producing 1 ${ResourcesIds[calldata.resource_type]} labor:`)} ${calldata.cost.length > 0 ? calldata.cost.map(c => `
    │     ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`)
       .join('') : chalk.blue('Can\'t be produced with resources')}
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
    const data = {
      token: tokenAddress,
      resource_type: resourceId,
    }
    resourceWhitelistConfigs.push(data);

    console.log(
      chalk.yellow('     ➔ ') + 
      chalk.white(resourceName.padEnd(12)) +
      chalk.gray('[') + chalk.cyan(`#${data.resource_type}`.padEnd(4)) + chalk.gray(']') +
      chalk.gray(' ⟶  ') + 
      chalk.white(shortHexAddress(data.token))
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

  const calldataArray: { building_category: BuildingType; population: number; capacity: number }[] = [];
  const buildingPopulation = config.config.buildings.buildingPopulation;
  const buildingCapacity = config.config.buildings.buildingCapacity;

  for (const buildingId of Object.keys(buildingPopulation) as unknown as BuildingType[]) {
    if (buildingPopulation[buildingId] !== 0 || buildingCapacity[buildingId] !== 0) {
      const calldata = {
        building_category: buildingId,
        population: buildingPopulation[buildingId] ?? 0,
        capacity: buildingCapacity[buildingId] ?? 0,
      }

      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[calldata.building_category])}
    │  ${chalk.gray('Consumes')} ${chalk.white(calldata.population)} ${chalk.gray('population')}
    │  ${chalk.gray('Adds')} ${chalk.white(calldata.capacity)} ${chalk.gray('capacity')}
    └────────────────────────────────`));

      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_building_category_pop_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setPopulationConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    base_population: config.config.populationCapacity.basePopulation,
  }

  console.log(chalk.cyan(`
  👥 Population Configuration
  ══════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Base Parameters')}
    │  ${chalk.gray('Starting Population:')}    ${chalk.white(calldata.base_population)}
    └────────────────────────────────`));

  const tx = await config.provider.set_population_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setBuildingGeneralConfig = async (config: Config) => {

  const calldata = {
    signer: config.account,
    base_cost_percent_increase: config.config.buildings.buildingFixedCostScalePercent,
  }

  console.log(chalk.cyan(`
  🏗️  Building General Configuration
  ══════════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Cost Parameters')}
    │  ${chalk.gray('Base Cost Increase:')}    ${chalk.white(calldata.base_cost_percent_increase / 10_000 * 100 + '%')}
    └────────────────────────────────`));

  const tx = await config.provider.set_building_general_config(calldata);

  console.log(chalk.green(`\n   ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setBuildingConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🏗️  Building Configuration
  ═══════════════════════════`));

  const calldataArray = [];
  const buildingResourceProduced = config.config.buildings.buildingResourceProduced;
  const buildingCosts = config.config.buildings.buildingCosts;
  const scaledBuildingCosts = scaleResourceInputs(buildingCosts, config.config.resources.resourcePrecision);
  const BUILDING_COST_DISPLAY_ROWS = 6;
  
  for (const buildingId of Object.keys(buildingResourceProduced) as unknown as BuildingType[]) {
    if (scaledBuildingCosts[buildingId].length !== 0) {
      const costs = scaledBuildingCosts[buildingId];
      const calldata = {
        building_category: buildingId,
        building_resource_type: buildingResourceProduced[buildingId] as ResourcesIds,
        cost_of_building: costs
      };
      calldataArray.push(calldata);

      // buildingScalePercent only used for display logic. not part of the calldata
      const buildingScalePercent = config.config.buildings.buildingFixedCostScalePercent;
      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[buildingId])}
    │  ${chalk.gray('Produces:')} ${chalk.white(ResourcesIds[calldata.building_resource_type as ResourcesIds])}
    │  ${chalk.gray('Building Costs (with ')}${chalk.white(buildingScalePercent / 10_000 * 100 + '%')}${chalk.gray(' increase per building):')}
    │  
    │  ${chalk.gray('┌──────────')}${calldata.cost_of_building.map(c => '─'.repeat(12)).join('')}
    │  ${chalk.gray('│')} Building ${calldata.cost_of_building.map(c => chalk.white(ResourcesIds[c.resource].padEnd(12))).join('')}
    │  ${chalk.gray('├──────────')}${calldata.cost_of_building.map(c => '─'.repeat(12)).join('')}${Array.from({length: BUILDING_COST_DISPLAY_ROWS}, (_, i) => {
        const buildingNum = i + 1;
        const costsStr = calldata.cost_of_building.map(c => {
          const multiplier = Math.pow(1 + buildingScalePercent / 10_000, buildingNum - 1);
          return chalk.white(inGameAmount(c.amount * multiplier, config.config).padEnd(12));
        }).join('');
        return `
    │  ${chalk.yellow(('No #' + buildingNum).padEnd(8))}${chalk.gray('│')} ${costsStr}`;
      }).join('')}
    │  ${chalk.gray('└──────────')}${calldata.cost_of_building.map(c => '─'.repeat(12)).join('')}
    └────────────────────────────────`));

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
    config.config.resources.resourcePrecision,
  );

  for (const level of Object.keys(REALM_UPGRADE_COSTS_SCALED) as unknown as number[]) {
    if (REALM_UPGRADE_COSTS_SCALED[level].length !== 0) {
      const costs = REALM_UPGRADE_COSTS_SCALED[level];
      const calldata = {
        level,
        cost_of_level: costs.map((cost) => ({
            ...cost,
            amount: cost.amount,
          })),    
        };
      
      console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(`Level ${calldata.level}`)}
    │  ${chalk.gray('Upgrade Costs:')}${calldata.cost_of_level.map(c => `
    │     ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`)
       .join('')}
    └────────────────────────────────`));


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
  const calldata = {
    signer: config.account,
    new_max_level,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Level Cap')}
    │  ${chalk.gray('Maximum Level:')}     ${chalk.white(calldata.new_max_level)}
    └────────────────────────────────`));

  const tx = await config.provider.set_realm_max_level_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};


export const setWeightConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚖️  Resource Weight Configuration
  ═══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Resource Weights')}`));

  const calldataArray = Object.entries(config.config.resources.resourceWeightsGrams).map(([resourceId, weight]) => {
    const calldata = {
      entity_type: resourceId,
      weight_gram: weight,
    }
    console.log(chalk.cyan(`    │  ${chalk.gray(String(ResourcesIds[calldata.entity_type as keyof typeof ResourcesIds]).padEnd(12))} ${chalk.white(addCommas(calldata.weight_gram / 1000))} kg`));
    return calldata;
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

  const calldata = {
    signer: config.account,
    config_id: 0,
    regular_immunity_ticks,
    hyperstructure_immunity_ticks,
    battle_delay_seconds,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Battle Parameters')}
    │  ${chalk.gray('Regular Immunity:')}      ${chalk.white(calldata.regular_immunity_ticks + ' ticks')}
    │  ${chalk.gray('Structure Immunity:')}    ${chalk.white(calldata.hyperstructure_immunity_ticks + ' ticks')}
    │  ${chalk.gray('Battle Seige Delay:')}    ${chalk.white(hourMinutesSeconds(calldata.battle_delay_seconds))}
    └────────────────────────────────`));

  const tx = await config.provider.set_battle_config(calldata);

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


  const calldata = {
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
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Stats')}
    │  ${chalk.gray('Base Health:')}          ${chalk.white(calldata.health)}
    │  ${chalk.gray('Knight Strength:')}      ${chalk.white(calldata.knight_strength)}
    │  ${chalk.gray('Paladin Strength:')}     ${chalk.white(calldata.paladin_strength)}
    │  ${chalk.gray('Crossbow Strength:')}    ${chalk.white(calldata.crossbowman_strength)}
    │
    │  ${chalk.yellow('Combat Modifiers')}
    │  ${chalk.gray('Advantage:')}            ${chalk.white(calldata.advantage_percent / 10_000 * 100 + '%')}
    │  ${chalk.gray('Disadvantage:')}         ${chalk.white(calldata.disadvantage_percent / 10_000 * 100 + '%')}
    │  ${chalk.gray('Max Troop Count Per Army:')} ${chalk.white(inGameAmount(calldata.max_troop_count, config.config))}
    │
    │  ${chalk.yellow('Army Parameters')}
    │  ${chalk.gray('Free per Structure:')}   ${chalk.white(calldata.army_free_per_structure)}
    │  ${chalk.gray('Extra per Military:')}   ${chalk.white(calldata.army_extra_per_military_building)}
    │  ${chalk.gray('Max per Structure:')}    ${chalk.white(calldata.army_max_per_structure)}
    │
    │  ${chalk.yellow('Battle Mechanics')}
    │  ${chalk.gray('Pillage Divisor:')}      ${chalk.white(calldata.pillage_health_divisor)}
    │  ${chalk.gray('Early Battle Leave Troop Slash:')} ${chalk.white(`${calldata.battle_leave_slash_num}/${calldata.battle_leave_slash_denom}`)}
    │  ${chalk.gray('Time Scale:')}           ${chalk.white(calldata.battle_time_scale)}
    │  ${chalk.gray('Max Duration:')}         ${chalk.white(hourMinutesSeconds(calldata.battle_max_time_seconds))}
    └────────────────────────────────`));

  const tx = await config.provider.set_troop_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setupGlobals = async (config: Config) => {
  const bankCalldata = {
    signer: config.account,
    lords_cost: config.config.banks.lordsCost * config.config.resources.resourcePrecision,
    lp_fee_num: config.config.banks.lpFeesNumerator,
    lp_fee_denom: config.config.banks.lpFeesDenominator,
  }
  console.log(chalk.cyan(`
  🌍 Global Configuration
  ═══════════════════════`));

  // Bank Config
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Bank Parameters')}
    │  ${chalk.gray('LORDS Cost:')}        ${chalk.white(inGameAmount(bankCalldata.lords_cost, config.config))}
    │  ${chalk.gray('LP Fee Rate:')}       ${chalk.white(`${bankCalldata.lp_fee_num}/${bankCalldata.lp_fee_denom}`)}
    └────────────────────────────────`));
  
  const txBank = await config.provider.set_bank_config(bankCalldata);
  console.log(chalk.green(`    ✔ Bank configured `) + chalk.gray(txBank.statusReceipt));

  // Tick Configs

  const defaultTickCalldata = {
    signer: config.account,
    tick_id: TickIds.Default,
    tick_interval_in_seconds: config.config.tick.defaultTickIntervalInSeconds,
  }

  const armiesTickCalldata = {
    signer: config.account,
    tick_id: TickIds.Armies,
    tick_interval_in_seconds: config.config.tick.armiesTickIntervalInSeconds,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Tick Intervals')}
    │  ${chalk.gray('Default:')}           ${chalk.white(hourMinutesSeconds(defaultTickCalldata.tick_interval_in_seconds))}
    │  ${chalk.gray('Armies:')}            ${chalk.white(hourMinutesSeconds(armiesTickCalldata.tick_interval_in_seconds))}
    └────────────────────────────────`));

  const txDefaultTick = await config.provider.set_tick_config(defaultTickCalldata);
  console.log(chalk.green(`    ✔ Default tick configured `) + chalk.gray(txDefaultTick.statusReceipt));

  const txArmiesTick = await config.provider.set_tick_config(armiesTickCalldata);
  console.log(chalk.green(`    ✔ Armies tick configured `) + chalk.gray(txArmiesTick.statusReceipt));

  // Map Config
  const mapCalldata = {
    signer: config.account,
    config_id: 0,
    reward_amount: config.config.exploration.reward * config.config.resources.resourcePrecision,
    shards_mines_fail_probability: config.config.exploration.shardsMinesFailProbability,
  }
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Map Parameters')}
    │  ${chalk.gray('Exploration Reward:')} ${chalk.white(inGameAmount(mapCalldata.reward_amount, config.config))}
    │  ${chalk.gray('Shards Mines Reward Fail Rate:')}     ${chalk.white((mapCalldata.shards_mines_fail_probability / (mapCalldata.shards_mines_fail_probability + SHARDS_MINES_WIN_PROBABILITY) * 100).toFixed(2) + '%')}
    └────────────────────────────────`));

  const txMap = await config.provider.set_map_config(mapCalldata);
  console.log(chalk.green(`    ✔ Map configured `) + chalk.gray(txMap.statusReceipt));

  // Stamina Costs
  const explorationStaminaCalldata = {
    signer: config.account,
    travel_type: TravelTypes.Explore,
    cost: config.config.stamina.exploreCost,
  }

  const travelStaminaCalldata = {
    signer: config.account,
    travel_type: TravelTypes.Travel,
    cost: config.config.stamina.travelCost,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Stamina Costs')}
    │  ${chalk.gray('For Exploration:')}   ${chalk.white(explorationStaminaCalldata.cost)} stamina
    │  ${chalk.gray('For Travel:')}    ${chalk.white(travelStaminaCalldata.cost)} stamina
    └────────────────────────────────`));

  const txExploreStaminaCost = await config.provider.set_travel_stamina_cost_config(explorationStaminaCalldata);
  console.log(chalk.green(`    ✔ Explore Stamina costs configured `) + chalk.gray(txExploreStaminaCost.statusReceipt));

  const txTravelStaminaCost = await config.provider.set_travel_stamina_cost_config(travelStaminaCalldata);
  console.log(chalk.green(`    ✔ Travel Stamina costs configured `) + chalk.gray(txTravelStaminaCost.statusReceipt));

  // Food Consumption
  const foodConsumptionCalldata = Object.entries(config.config.troop.troopFoodConsumption).map(([unit_type, costs]) => {
    return {
      signer: config.account,
      config_id: 0,
      unit_type,
      explore_wheat_burn_amount: costs.explore_wheat_burn_amount * config.config.resources.resourcePrecision,
      explore_fish_burn_amount: costs.explore_fish_burn_amount * config.config.resources.resourcePrecision,
      travel_wheat_burn_amount: costs.travel_wheat_burn_amount * config.config.resources.resourcePrecision,
      travel_fish_burn_amount: costs.travel_fish_burn_amount * config.config.resources.resourcePrecision,
    }
  });
  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Food Consumption')}`));

  for (const calldata of foodConsumptionCalldata) {
    console.log(chalk.cyan(`    │  ${chalk.gray(ResourcesIds[calldata.unit_type as keyof typeof ResourcesIds])}
    │     ${chalk.gray('Explore:')}  ${chalk.white(`${inGameAmount(calldata.explore_wheat_burn_amount, config.config)} wheat, ${inGameAmount(calldata.explore_fish_burn_amount, config.config)} fish`)}
    │     ${chalk.gray('Travel:')}   ${chalk.white(`${inGameAmount(calldata.travel_wheat_burn_amount, config.config)} wheat, ${inGameAmount(calldata.travel_fish_burn_amount, config.config)} fish`)}`));

    const tx = await config.provider.set_travel_food_cost_config(calldata);
    console.log(chalk.green(`    │  ✔ ${ResourcesIds[calldata.unit_type as keyof typeof ResourcesIds]} configured `) + chalk.gray(tx.statusReceipt));
  };
  console.log(chalk.cyan(`    └────────────────────────────────`));
};

export const setCapacityConfig = async (config: Config) => {
  const calldata = Object.entries(config.config.carryCapacityGram).map(([category, weight]) => {
    return {
      signer: config.account,
      category,
      weight_gram: weight,
    }
  });
  console.log(chalk.cyan(`
  📦 Carry Capacity Configuration
  ═══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Max Weight Per Category')}${calldata.map(({category, weight_gram}) => `
    │  ${chalk.gray(String(CapacityConfigCategory[category as keyof typeof CapacityConfigCategory]).padEnd(12))} ${chalk.white(addCommas(BigInt(weight_gram)))} ${chalk.gray('grams')} 
    │  ${chalk.gray('').padEnd(12)} ${chalk.gray('i.e (')} ${chalk.white(addCommas(BigInt(weight_gram) / BigInt(1000)))} ${chalk.gray('kg')} ${chalk.gray(')')})`)
    .join('')}
    └────────────────────────────────`));

  for (const data of calldata) {
    const tx = await config.provider.set_capacity_config(data);
    console.log(chalk.green(`    ✔ ${CapacityConfigCategory[data.category as keyof typeof CapacityConfigCategory]} weight configured `) + chalk.gray(tx.statusReceipt));
  }
  console.log();
};

export const setSeasonConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🎮 Season Configuration
  ═══════════════════════`));

  const now = Math.floor(new Date().getTime() / 1000);
  const startAt = now + config.config.season.startAfterSeconds;

  const seasonCalldata = {
    signer: config.account,
    season_pass_address: config.config.setup!.addresses.seasonPass,
    realms_address: config.config.setup!.addresses.realms,
    lords_address: config.config.setup!.addresses.lords,
    start_at: startAt,
  }

  const seasonBridgeCalldata = {
    signer: config.account,
    close_after_end_seconds: config.config.season.bridgeCloseAfterEndSeconds,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Season Parameters')}
    │  ${chalk.gray('Start Time:')}   ${chalk.white(new Date(seasonCalldata.start_at * 1000).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'UTC'
    }))} UTC
    │  ${chalk.gray('Bridge Closes:')}   ${chalk.white(hourMinutesSeconds(seasonBridgeCalldata.close_after_end_seconds))} after game ends
    │
    │  ${chalk.yellow('Contract Addresses')}
    │  ${chalk.gray('Season Pass:')}       ${chalk.white(shortHexAddress(seasonCalldata.season_pass_address))}
    │  ${chalk.gray('Realms:')}            ${chalk.white(shortHexAddress(seasonCalldata.realms_address))}
    │  ${chalk.gray('LORDS:')}             ${chalk.white(shortHexAddress(seasonCalldata.lords_address))}
    └────────────────────────────────`));

  const setSeasonTx = await config.provider.set_season_config(seasonCalldata);
  const setSeasonBridgeTx = await config.provider.set_season_bridge_config(seasonBridgeCalldata);

  console.log(chalk.green(`    ✔ Season configured `) + chalk.gray(setSeasonTx.statusReceipt));
  console.log(chalk.green(`    ✔ Bridge configured `) + chalk.gray(setSeasonBridgeTx.statusReceipt) + '\n');
};

export const setVRFConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  🎲 VRF Configuration
  ═══════════════════════`));

  if (BigInt(config.config.vrf.vrfProviderAddress) === BigInt(0)) {
    console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Status')}
    │  ${chalk.gray('Provider:')}          ${chalk.red('Not configured')}
    └────────────────────────────────`));
    return;
  }

  const vrfCalldata = {
    signer: config.account,
    vrf_provider_address: config.config.vrf.vrfProviderAddress,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('VRF Provider')}
    │  ${chalk.gray('Address:')}           ${chalk.white(shortHexAddress(vrfCalldata.vrf_provider_address))}
    └────────────────────────────────`));

  const tx = await config.provider.set_vrf_config(vrfCalldata);
  console.log(chalk.green(`    ✔ VRF configured `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setResourceBridgeFeesConfig = async (config: Config) => {
  const bridgeFeesCalldata = {
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
  }
  console.log(chalk.cyan(`
  🌉 Bridge Fees Configuration
  ══════════════════════════`));

  const fees = {
    deposits: {
      'veLORDS Deposit': bridgeFeesCalldata.velords_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Season Pool Deposit': bridgeFeesCalldata.season_pool_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Client Deposit': bridgeFeesCalldata.client_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Max Bank Fee on Deposit': bridgeFeesCalldata.max_bank_fee_dpt_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
    },
    withdrawals: {
      'veLORDS Withdraw': bridgeFeesCalldata.velords_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Season Pool Withdraw': bridgeFeesCalldata.season_pool_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Client Withdraw': bridgeFeesCalldata.client_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%',
      'Max Bank Fee on Withdraw': bridgeFeesCalldata.max_bank_fee_wtdr_percent / BRIDGE_FEE_DENOMINATOR * 100 + '%'
    }
  };

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Deposit Fee Structure')}${Object.entries(fees.deposits).map(([name, value]) => `
    │  ${chalk.gray(name.padEnd(20))} ${chalk.white(value)}`)
    .join('')}
    │
    │  ${chalk.yellow('Withdrawal Fee Structure')}${Object.entries(fees.withdrawals).map(([name, value]) => `
    │  ${chalk.gray(name.padEnd(20))} ${chalk.white(value)}`)
    .join('')}
    │
    │  ${chalk.yellow('Recipients')}
    │  ${chalk.gray('veLORDS:')}          ${chalk.white(shortHexAddress(config.config.bridge.velords_fee_recipient.toString()))}
    │  ${chalk.gray('Season Pool:')}      ${chalk.white(shortHexAddress(config.config.bridge.season_pool_fee_recipient.toString()))}
    └────────────────────────────────`));

  const tx = await config.provider.set_resource_bridge_fees_config(bridgeFeesCalldata);
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
    config.config.resources.resourcePrecision,
  );

  const hyperstructureCalldata = {
    signer: config.account,
    resources_for_completion: costs,
    time_between_shares_change: hyperstructureTimeBetweenSharesChangeSeconds,
    points_per_cycle: hyperstructurePointsPerCycle,
    points_for_win: hyperstructurePointsForWin,
    points_on_completion: hyperstructurePointsOnCompletion,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Points System')}
    │  ${chalk.gray('Per Cycle:')}        ${chalk.white(addCommas(hyperstructureCalldata.points_per_cycle))}
    │  ${chalk.gray('On Completion:')}    ${chalk.white(addCommas(hyperstructureCalldata.points_on_completion))}
    │  ${chalk.gray('For Win:')}          ${chalk.white(addCommas(hyperstructureCalldata.points_for_win))}
    │
    │  ${chalk.yellow('Timing')}
    │  ${chalk.gray('Minimum Time Between Share Changes:')}     ${chalk.white(hourMinutesSeconds(hyperstructureCalldata.time_between_shares_change))}
    │
    │  ${chalk.yellow('Resource Tier')}${hyperstructureCalldata.resources_for_completion.map(c => `
    │  ${chalk.gray(ResourceTier[c.resource_tier].padEnd(12))} ${chalk.white(inGameAmount(c.min_amount, config.config))} ${chalk.gray('to')} ${chalk.white(inGameAmount(c.max_amount, config.config))}`)
    .join('')}
    └────────────────────────────────`));
  const tx = await config.provider.set_hyperstructure_config(hyperstructureCalldata);

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
  const staminaRefillCalldata = {
    signer: config.account,
    amount_per_tick: config.config.stamina.refillPerTick,
    start_boost_tick_count: config.config.stamina.startBoostTickCount,
  }
  
  console.log(chalk.cyan(`
  🔋 Stamina Refill Configuration
  ══════════════════════════════`));

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Refill Parameters')}
    │  ${chalk.gray('Amount per Tick:')}    ${chalk.white(staminaRefillCalldata.amount_per_tick)}
    │  ${chalk.gray('Initial Boost:')}      ${chalk.white(staminaRefillCalldata.start_boost_tick_count + ' ticks worth of stamina immediately after army creation')}
    └────────────────────────────────`));

  const tx = await config.provider.set_stamina_refill_config(staminaRefillCalldata);
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const setMercenariesConfig = async (config: Config) => {
  console.log(chalk.cyan(`
  ⚔️  Mercenaries Configuration
  ═══════════════════════════════`));


  const calldata = {
    signer: config.account,
    knights_lower_bound: config.config.mercenaries.knights_lower_bound * config.config.resources.resourcePrecision,
    knights_upper_bound: config.config.mercenaries.knights_upper_bound * config.config.resources.resourcePrecision,
    paladins_lower_bound: config.config.mercenaries.paladins_lower_bound * config.config.resources.resourcePrecision,
    paladins_upper_bound: config.config.mercenaries.paladins_upper_bound * config.config.resources.resourcePrecision,
    crossbowmen_lower_bound: config.config.mercenaries.crossbowmen_lower_bound * config.config.resources.resourcePrecision,
    crossbowmen_upper_bound: config.config.mercenaries.crossbowmen_upper_bound * config.config.resources.resourcePrecision,
    rewards: config.config.mercenaries.rewards.map((reward) => ({
      resource: reward.resource,
      amount: reward.amount * config.config.resources.resourcePrecision
    })),
  };
  const bounds = {
    Knights: {
      lower: calldata.knights_lower_bound,
      upper: calldata.knights_upper_bound
    },
    Paladins: {
      lower: calldata.paladins_lower_bound,
      upper: calldata.paladins_upper_bound
    },
    Crossbowmen: {
      lower: calldata.crossbowmen_lower_bound,
      upper: calldata.crossbowmen_upper_bound
    }
  };

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Unit Bounds')}${Object.entries(bounds).map(([unit, {lower, upper}]) => `
    │  ${chalk.gray(unit.padEnd(12))} ${chalk.white(inGameAmount(lower, config.config))} ${chalk.gray('to')} ${chalk.white(inGameAmount(upper, config.config))}`)
    .join('')}
    │
    │  ${chalk.yellow('Rewards:')}${calldata.rewards.map(r => `
    │     ${chalk.white(`${inGameAmount(r.amount, config.config)} ${ResourcesIds[r.resource]}`)}`)
    .join('')}
    └────────────────────────────────`));

  const tx = await config.provider.set_mercenaries_config(calldata);

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

  const calldata = {
    signer: config.account,
    center,
    base_distance,
    min_first_layer_distance,
    points_placed,
    current_layer,
    current_side,
    current_point_on_side,
  }

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Layout Parameters')}
    │  ${chalk.gray('Center:')}            ${chalk.white(`(${calldata.center}, ${calldata.center})`)}
    │  ${chalk.gray('Base Distance:')}     ${chalk.white(calldata.base_distance)}
    │  ${chalk.gray('Min First Layer:')}   ${chalk.white(calldata.min_first_layer_distance)}
    │
    │  ${chalk.yellow('Current State')}
    │  ${chalk.gray('Points Placed:')}     ${chalk.white(calldata.points_placed)}
    │  ${chalk.gray('Current Layer:')}     ${chalk.white(calldata.current_layer)}
    │  ${chalk.gray('Current Side:')}      ${chalk.white(calldata.current_side)}
    │  ${chalk.gray('Point on Side:')}     ${chalk.white(calldata.current_point_on_side)}
    └────────────────────────────────`));

  const tx = await config.provider.set_settlement_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const createAdminBank = async (config: Config) => {
  console.log(chalk.cyan(`
  🏦 Admin Bank Creation
  ═══════════════════════`));

  const calldata = {
    signer: config.account,
    name: config.config.banks.name,
    coord: { x: FELT_CENTER, y: FELT_CENTER },
    owner_fee_num: config.config.banks.ownerFeesNumerator,
    owner_fee_denom: config.config.banks.ownerFeesDenominator,
    owner_bridge_fee_dpt_percent: config.config.banks.ownerBridgeFeeOnDepositPercent,
    owner_bridge_fee_wtdr_percent: config.config.banks.ownerBridgeFeeOnWithdrawalPercent,
  }
  

  console.log(chalk.cyan(`
    ┌─ ${chalk.yellow('Bank Parameters')}
    │  ${chalk.gray('Name:')}              ${chalk.white(calldata.name)}
    │  ${chalk.gray('Location:')}          ${chalk.white(`(${FELT_CENTER}, ${FELT_CENTER})`)}
    │  ${chalk.gray('Owner Fee Rate:')}    ${chalk.white(`${calldata.owner_fee_num}/${calldata.owner_fee_denom}`)}
    │  ${chalk.gray('Bridge Fee (In):')}   ${chalk.white(calldata.owner_bridge_fee_dpt_percent + '%')}
    │  ${chalk.gray('Bridge Fee (Out):')}  ${chalk.white(calldata.owner_bridge_fee_wtdr_percent + '%')}
    └────────────────────────────────`));

  const tx = await config.provider.create_admin_bank(calldata);
  console.log(chalk.green(`\n    ✔ Bank created successfully `) + chalk.gray(tx.statusReceipt) + '\n');
};

export const mintResources = async (config: Config) => {
  console.log(chalk.cyan(`
  💰 Minting Resources
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

    const calldata = {
      resource_type: resourceId,
      resource_amount: resourceAmount,
      lords_amount: lordsAmount,
    };
    

    console.log(chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[calldata.resource_type as keyof typeof ResourcesIds])} Pool
    │  ${chalk.gray('Resource Amount:')} ${chalk.white(inGameAmount(calldata.resource_amount, config.config))}
    │  ${chalk.gray('LORDS Amount:')}    ${chalk.white(inGameAmount(calldata.lords_amount, config.config))}
    └────────────────────────────────`));

    calls.push(calldata);
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
