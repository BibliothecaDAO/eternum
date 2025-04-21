import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  BuildingType,
  CapacityConfig,
  type Config as EternumConfig,
  HexGrid,
  type ResourceInputs,
  type ResourceOutputs,
  type ResourceWhitelistConfig,
  ResourcesIds,
  scaleResourceInputs,
  scaleResourceOutputs,
  scaleResources,
} from "@bibliothecadao/types";

import chalk from "chalk";

import type { EternumProvider } from "@bibliothecadao/provider";
import fs from "fs";
import type { Account } from "starknet";
import type { Chain } from "utils/utils";
import { addCommas, hourMinutesSeconds, inGameAmount, shortHexAddress } from "../utils/formatting";

interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumConfig;
}

export class GameConfigDeployer {
  public globalConfig: EternumConfig;

  constructor(config: EternumConfig) {
    this.globalConfig = config;
  }

  async setupAll(account: Account, provider: EternumProvider) {
    await this.setupNonBank(account, provider);
    await this.setupBank(account, provider);
  }

  async setupNonBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await setWorldConfig(config);
    await setWonderBonusConfig(config);
    await setAgentConfig(config);
    await setVillageControllersConfig(config);
    await SetResourceFactoryConfig(config);
    await setResourceBridgeWhitelistConfig(config);
    await setTradeConfig(config);
    await setStartingResourcesConfig(config);
    await setSeasonConfig(config);
    await setVRFConfig(config);
    await setResourceBridgeFeesConfig(config);
    await setBuildingConfig(config);
    await setWeightConfig(config);
    await setBattleConfig(config);
    await setTroopConfig(config);
    await setRealmUpgradeConfig(config);
    await setStructureMaxLevelConfig(config);
    await setupGlobals(config);
    await setCapacityConfig(config);
    await setSpeedConfig(config);
    await setHyperstructureConfig(config);
    await setSettlementConfig(config);
  }

  async setupBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await createBanks(config);
    // await mintResources(config);
    await addLiquidity(config);
  }

  getResourceOutputsScaled(): ResourceOutputs {
    return scaleResourceOutputs(
      this.globalConfig.resources.productionByComplexRecipeOutputs,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.buildings.complexBuildingCosts,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getResourceInputsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.resources.productionByComplexRecipe,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getHyperstructureConstructionCostsScaled(): {
    resource: number;
    amount: number;
  }[] {
    return scaleResources(
      this.globalConfig.hyperstructures.hyperstructureConstructionCost,
      this.globalConfig.resources.resourcePrecision,
    );
  }

  getHyperstructureTotalCostsScaled(): { resource: number; amount: number }[] {
    // Create a utility function if needed or return empty array
    return [];
  }
}

export const setStartingResourcesConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏆 Starting Resources Configuration 
  ═══════════════════════════════`),
  );

  const realmStartResourcesArray = [];
  for (const elem of Object.values(config.config.startingResources)) {
    const calldata = {
      resource: elem.resource,
      amount: elem.amount * config.config.resources.resourcePrecision,
    };

    console.log(
      chalk.cyan(`
    ✧ Realm Resource ${chalk.yellow(ResourcesIds[calldata.resource])}:`),
    );

    console.log(chalk.cyan(`      ∙ ${chalk.cyan(inGameAmount(calldata.amount, config.config))}`));

    realmStartResourcesArray.push(calldata);
  }

  const villageStartResourcesArray = [];
  for (const elem of Object.values(config.config.villageStartingResources)) {
    const calldata = {
      resource: elem.resource,
      amount: elem.amount * config.config.resources.resourcePrecision,
    };

    console.log(
      chalk.cyan(`
    ✧ Village Resource ${chalk.yellow(ResourcesIds[calldata.resource])}:`),
    );

    console.log(chalk.cyan(`      ∙ ${chalk.cyan(inGameAmount(calldata.amount, config.config))}`));
    villageStartResourcesArray.push(calldata);
  }

  const tx = await config.provider.set_starting_resources_config({
    signer: config.account,
    realmStartingResources: realmStartResourcesArray,
    villageStartingResources: villageStartResourcesArray,
  });

  console.log(chalk.gray(`\n    ⚡ Transaction: ${tx.statusReceipt}\n`));
};

export const setWorldConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
   🌎 WORLD CONFIGURATION ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`),
  );
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow(`Admin Address`)}
    │  ${chalk.gray(`${config.account.address}`)}
    └────────────────────────────────`),
  );

  const adminAddresstx = await config.provider.set_world_config({
    signer: config.account,
    admin_address: config.account.address,
  });

  console.log(
    chalk.cyan(`
    ${chalk.gray("Admin Address Transaction:")} ${chalk.white(adminAddresstx.statusReceipt)}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `),
  );

  const mercenariesName = "0x5468652056616e6775617264";
  const mercenariesTx = await config.provider.set_mercenaries_name_config({
    signer: config.account,
    name: mercenariesName, // The Vanguard
  });
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow(`Setting Mercenaries Name to ${mercenariesName}`)}
    └────────────────────────────────`),
  );

  console.log(
    chalk.cyan(`
    ${chalk.gray("Mercenaries Name Transaction:")} ${chalk.white(mercenariesTx.statusReceipt)}
    ${chalk.green("✨ Configuration successfully deployed")}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `),
  );
};

export const SetResourceFactoryConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  ⚡ RESOURCE PRODUCTION CONFIGURATION ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`),
  );

  const calldataArray = [];

  const scaledProductionByResourceRecipe = scaleResourceInputs(
    config.config.resources.productionByComplexRecipe,
    config.config.resources.resourcePrecision,
  );

  const scaledProductionByResourceRecipeOutputs = scaleResourceOutputs(
    config.config.resources.productionByComplexRecipeOutputs,
    config.config.resources.resourcePrecision,
  );

  const scaledProductionBySimpleRecipe = scaleResourceInputs(
    config.config.resources.productionBySimpleRecipe,
    config.config.resources.resourcePrecision,
  );

  const scaledProductionBySimpleRecipeOutputs = scaleResourceOutputs(
    config.config.resources.productionBySimpleRecipeOutputs,
    config.config.resources.resourcePrecision,
  );

  const scaledProductionOfLaborOutputs = scaleResourceOutputs(
    config.config.resources.laborOutputPerResource,
    config.config.resources.resourcePrecision,
  );

  for (const resourceId of Object.keys(scaledProductionByResourceRecipe) as unknown as ResourcesIds[]) {
    const calldata = {
      resource_type: resourceId,
      realm_output_per_second: scaledProductionByResourceRecipeOutputs[resourceId],
      village_output_per_second: scaledProductionByResourceRecipeOutputs[resourceId] / 2,
      labor_output_per_resource: scaledProductionOfLaborOutputs[resourceId],
      resource_output_per_simple_input: scaledProductionBySimpleRecipeOutputs[resourceId],
      simple_input_resources_list: scaledProductionBySimpleRecipe[resourceId],
      resource_output_per_complex_input: scaledProductionByResourceRecipeOutputs[resourceId],
      complex_input_resources_list: scaledProductionByResourceRecipe[resourceId],
    };

    calldataArray.push(calldata);

    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[calldata.resource_type])}
    │  ${chalk.gray(`${ResourcesIds[calldata.resource_type]} produced per tick, per building for realm:`)} ${chalk.white(`${inGameAmount(calldata.realm_output_per_second, config.config)} ${chalk.yellow(ResourcesIds[calldata.resource_type])}`)}
    │  ${chalk.gray(`${ResourcesIds[calldata.resource_type]} produced per tick, per building for village:`)} ${chalk.white(`${inGameAmount(calldata.village_output_per_second, config.config)} ${chalk.yellow(ResourcesIds[calldata.resource_type])}`)}
    │  ${chalk.gray(`${chalk.white(`${inGameAmount(calldata.resource_output_per_simple_input, config.config)}`)} ${chalk.yellow(`${ResourcesIds[calldata.resource_type]}`)} is produced, for every ${chalk.white(`1`)} labor given`)}
    │  ${chalk.gray(`${chalk.white(`${inGameAmount(calldata.resource_output_per_complex_input, config.config)}`)} ${chalk.yellow(`${ResourcesIds[calldata.resource_type]}`)} is produced, for every ${chalk.white(`1`)} unit of complex resources given`)}
    │  ${chalk.gray(`${chalk.white(`${inGameAmount(calldata.labor_output_per_resource, config.config)}`)}  ${chalk.yellow(`Labor`)} is produced, for every ${chalk.white(`1`)} ${chalk.yellow(`${ResourcesIds[calldata.resource_type]}`)} given`)} 
    │  ${chalk.gray(``)}
    │  ${chalk.gray(`Using Complex Burn Production Strategy:`)}
    │  ${
      calldata.complex_input_resources_list.length > 0
        ? chalk.gray(` Cost of producing 1 ${ResourcesIds[calldata.resource_type]}:`) +
          calldata.complex_input_resources_list
            .map(
              (c) => `
    │       ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`,
            )
            .join("")
        : `    ${chalk.blue("Can't be produced with complex strategy")}`
    }
    │  ${chalk.gray(``)}
    │  ${chalk.gray(`Using Labor Burn Production Strategy:`)}
    │  ${
      calldata.simple_input_resources_list.length > 0
        ? chalk.gray(` Cost of producing 1 ${ResourcesIds[calldata.resource_type]}:`) +
          calldata.simple_input_resources_list
            .map(
              (c) => `
    │       ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`,
            )
            .join("")
        : `    ${chalk.blue("Can't be produced using labor")}`
    }
    └────────────────────────────────`),
    );
  }

  const tx = await config.provider.set_resource_factory_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(
    chalk.cyan(`
    ${chalk.green("✨ Configuration successfully deployed")}
    ${chalk.gray("Transaction:")} ${chalk.white(tx.statusReceipt)}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `),
  );
};

export const setResourceBridgeWhitelistConfig = async (config: Config) => {
  console.log(chalk.cyan("\n⚡ BRIDGE WHITELIST CONFIGURATION"));
  console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const resourceWhitelistConfigs: ResourceWhitelistConfig[] = [];
  for (const [resourceName, resourceData] of Object.entries(config.config.setup!.addresses.resources)) {
    const [resourceId, tokenAddress] = resourceData as unknown as [string, string];
    const data = {
      token: tokenAddress,
      resource_type: resourceId,
    };
    resourceWhitelistConfigs.push(data);

    console.log(
      chalk.yellow("     ➔ ") +
        chalk.white(resourceName.padEnd(12)) +
        chalk.gray("[") +
        chalk.cyan(`#${data.resource_type}`.padEnd(4)) +
        chalk.gray("]") +
        chalk.gray(" ⟶  ") +
        chalk.white(shortHexAddress(data.token)),
    );
  }

  const tx = await config.provider.set_resource_bridge_whitlelist_config({
    signer: config.account,
    resource_whitelist_configs: resourceWhitelistConfigs,
  });

  console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.green("✔ ") + chalk.white("Configuration complete ") + chalk.gray(tx.statusReceipt) + "\n");
};

export const setBuildingConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏗️  Building Configuration
  ═══════════════════════════`),
  );

  const buildingResourceProduced = config.config.buildings.buildingResourceProduced;
  const buildingPopulation = config.config.buildings.buildingPopulation;
  const buildingCapacity = config.config.buildings.buildingCapacity;
  const complexBuildingCosts = config.config.buildings.complexBuildingCosts;
  const scaledComplexBuildingCosts = scaleResourceInputs(
    complexBuildingCosts,
    config.config.resources.resourcePrecision,
  );
  const simpleBuildingCosts = config.config.buildings.simpleBuildingCost;
  const scaledSimpleBuildingCosts = scaleResourceInputs(simpleBuildingCosts, config.config.resources.resourcePrecision);
  const BUILDING_COST_DISPLAY_ROWS = 6;
  const buildingScalePercent = config.config.buildings.buildingFixedCostScalePercent;

  // Set base building config
  const tx = await config.provider.set_building_config({
    signer: config.account,
    base_population: config.config.populationCapacity.basePopulation,
    base_cost_percent_increase: buildingScalePercent,
  });

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Building Config")}
    │  ${chalk.gray("Base Population:")} ${chalk.white(config.config.populationCapacity.basePopulation)}
    │  ${chalk.gray("Base Cost Percent Increase:")} ${chalk.white(buildingScalePercent)}
    └────────────────────────────────`),
  );

  console.log(chalk.green(`    ✔ Base configuration complete `) + chalk.gray(tx.statusReceipt));

  // Non Resource Building Config
  for (const buildingId of Object.keys(scaledComplexBuildingCosts) as unknown as BuildingType[]) {
    const costs = scaledComplexBuildingCosts[buildingId];
    const population = buildingPopulation[buildingId] ?? 0;
    const capacity = buildingCapacity[buildingId] ?? 0;
    console.log(
      chalk.cyan(`
      🏗️  Complex Building Cost
      ═══════════════════════════`),
    );
    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[buildingId])}
    │  ${chalk.gray("Produces:")} ${chalk.white(ResourcesIds[buildingResourceProduced[buildingId] as ResourcesIds])}
    │  ${chalk.gray("Consumes")} ${chalk.white(population)} ${chalk.gray("population")}
    │  ${chalk.gray("Adds")} ${chalk.white(capacity)} ${chalk.gray("capacity")}
    │  ${chalk.gray("Building Costs (with ")}${chalk.white((buildingScalePercent / 10_000) * 100 + "%")}${chalk.gray(" increase per building):")}
    │  
    │  ${chalk.gray("┌──────────")}${costs.map((c) => "─".repeat(12)).join("")}
    │  ${chalk.gray("│")} Building ${costs.map((c) => chalk.white(ResourcesIds[c.resource].padEnd(12))).join("")}
    │  ${chalk.gray("├──────────")}${costs.map((c) => "─".repeat(12)).join("")}${Array.from(
      { length: BUILDING_COST_DISPLAY_ROWS },
      (_, i) => {
        const buildingNum = i + 1;
        const costsStr = costs
          .map((c) => {
            const multiplier = Math.pow(1 + buildingScalePercent / 10_000, buildingNum - 1);
            return chalk.white(inGameAmount(c.amount * multiplier, config.config).padEnd(12));
          })
          .join("");
        return `
    │  ${chalk.yellow(("No #" + buildingNum).padEnd(8))}${chalk.gray("│")} ${costsStr}`;
      },
    ).join("")}
    │  ${chalk.gray("└──────────")}${costs.map((c) => "─".repeat(12)).join("")}
    └────────────────────────────────`),
    );
  }

  for (const buildingId of Object.keys(scaledSimpleBuildingCosts) as unknown as BuildingType[]) {
    const costs = scaledSimpleBuildingCosts[buildingId];
    const population = buildingPopulation[buildingId] ?? 0;
    const capacity = buildingCapacity[buildingId] ?? 0;
    console.log(
      chalk.cyan(`
          🏗️  Simple Building Cost
          ═══════════════════════════`),
    );
    console.log(
      chalk.cyan(`
        ┌─ ${chalk.yellow(BuildingType[buildingId])}
        │  ${chalk.gray("Produces:")} ${chalk.white(ResourcesIds[buildingResourceProduced[buildingId] as ResourcesIds])}
        │  ${chalk.gray("Consumes")} ${chalk.white(population)} ${chalk.gray("population")}
        │  ${chalk.gray("Adds")} ${chalk.white(capacity)} ${chalk.gray("capacity")}
        │  ${chalk.gray("Building Costs (with ")}${chalk.white((buildingScalePercent / 10_000) * 100 + "%")}${chalk.gray(" increase per building):")}
        │  
        │  ${chalk.gray("┌──────────")}${costs.map((c) => "─".repeat(12)).join("")}
        │  ${chalk.gray("│")} Building ${costs.map((c) => chalk.white(ResourcesIds[c.resource].padEnd(12))).join("")}
        │  ${chalk.gray("├──────────")}${costs.map((c) => "─".repeat(12)).join("")}${Array.from(
          { length: BUILDING_COST_DISPLAY_ROWS },
          (_, i) => {
            const buildingNum = i + 1;
            const costsStr = costs
              .map((c) => {
                const multiplier = Math.pow(1 + buildingScalePercent / 10_000, buildingNum - 1);
                return chalk.white(inGameAmount(c.amount * multiplier, config.config).padEnd(12));
              })
              .join("");
            return `
        │  ${chalk.yellow(("No #" + buildingNum).padEnd(8))}${chalk.gray("│")} ${costsStr}`;
          },
        ).join("")}
        │  ${chalk.gray("└──────────")}${costs.map((c) => "─".repeat(12)).join("")}
        └────────────────────────────────`),
    );
  }

  const calldataArray = [];

  for (const buildingId of Object.keys(scaledComplexBuildingCosts) as unknown as BuildingType[]) {
    calldataArray.push({
      building_category: buildingId,
      complex_building_cost: scaledComplexBuildingCosts[buildingId],
      simple_building_cost: scaledSimpleBuildingCosts[buildingId],
      population_cost: buildingPopulation[buildingId] ?? 0,
      capacity_grant: buildingCapacity[buildingId] ?? 0,
    });
  }
  const categoryTx = await config.provider.set_building_category_config({
    signer: config.account,
    calls: calldataArray,
  });
  console.log(chalk.green(`   ✔ Category configuration complete `) + chalk.gray(categoryTx.statusReceipt));
};

export const setRealmUpgradeConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏰 Realm Upgrade Configuration
  ═══════════════════════════════`),
  );

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

      console.log(
        chalk.cyan(`
    ┌─ ${chalk.yellow(`Level ${calldata.level}`)}
    │  ${chalk.gray("Upgrade Costs:")}${calldata.cost_of_level
      .map(
        (c) => `
    │     ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`,
      )
      .join("")}
    └────────────────────────────────`),
      );

      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_structure_level_config({
    signer: config.account,
    calls: calldataArray,
  });
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setStructureMaxLevelConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  👑 Realm Level Configuration
  ═══════════════════════════`),
  );

  const realm_max_level = config.config.realmMaxLevel - 1;
  const village_max_level = config.config.villageMaxLevel - 1;
  const calldata = {
    signer: config.account,
    realm_max_level,
    village_max_level,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Levels Cap")}
    │  ${chalk.gray(" Realm Maximum Level:")}     ${chalk.white(calldata.realm_max_level + 1)}
    │  ${chalk.gray(" Village Maximum Level:")}     ${chalk.white(calldata.village_max_level + 1)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_structure_max_level_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setWeightConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  ⚖️  Resource Weight Configuration
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Resource Weights")}`),
  );

  const calldataArray = Object.entries(config.config.resources.resourceWeightsGrams).map(([resourceId, weight]) => {
    const calldata = {
      entity_type: resourceId,
      weight_nanogram: weight,
    };
    console.log(
      chalk.cyan(
        `    │  ${chalk.gray(String(ResourcesIds[calldata.entity_type as keyof typeof ResourcesIds]).padEnd(12))} ${chalk.white(addCommas(calldata.weight_nanogram / 1000))} kg`,
      ),
    );
    return calldata;
  });
  console.log(chalk.cyan(`    └────────────────────────────────`));

  const tx = await config.provider.set_resource_weight_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setBattleConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  ⚔️  Battle System Configuration
  ═══════════════════════════════`),
  );

  const { graceTickCount: regular_immunity_ticks, graceTickCountHyp: hyperstructure_immunity_ticks } =
    config.config.battle;

  const calldata = {
    signer: config.account,
    regular_immunity_ticks,
    hyperstructure_immunity_ticks,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Battle Parameters")}
    │  ${chalk.gray(" Immunity Period:")}      ${chalk.white(calldata.regular_immunity_ticks + " ticks")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_battle_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setTroopConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  ⚔️  Troop System Configuration
  ═══════════════════════════════`),
  );

  const {
    damage: {
      t1DamageValue: t1_damage_value,
      t2DamageMultiplier: t2_damage_multiplier,
      t3DamageMultiplier: t3_damage_multiplier,
      damageRaidPercentNum: damage_raid_percent_num,
      damageBiomeBonusNum: damage_biome_bonus_num,
      damageScalingFactor: damage_scaling_factor,
      damageBetaSmall: damage_beta_small,
      damageBetaLarge: damage_beta_large,
      damageC0: damage_c0,
      damageDelta: damage_delta,
    },
    stamina: {
      staminaGainPerTick: stamina_gain_per_tick,
      staminaInitial: stamina_initial,
      staminaBonusValue: stamina_bonus_value,
      staminaKnightMax: stamina_knight_max,
      staminaPaladinMax: stamina_paladin_max,
      staminaCrossbowmanMax: stamina_crossbowman_max,
      staminaAttackReq: stamina_attack_req,
      staminaAttackMax: stamina_attack_max,
      staminaExploreWheatCost: stamina_explore_wheat_cost,
      staminaExploreFishCost: stamina_explore_fish_cost,
      staminaExploreStaminaCost: stamina_explore_stamina_cost,
      staminaTravelWheatCost: stamina_travel_wheat_cost,
      staminaTravelFishCost: stamina_travel_fish_cost,
      staminaTravelStaminaCost: stamina_travel_stamina_cost,
    },
    limit: {
      explorerMaxPartyCount: explorer_max_party_count,
      explorerAndGuardMaxTroopCount: explorer_guard_max_troop_count,
      guardResurrectionDelay: guard_resurrection_delay,
      mercenariesTroopLowerBound: mercenaries_troop_lower_bound,
      mercenariesTroopUpperBound: mercenaries_troop_upper_bound,
      agentTroopLowerBound: agent_troop_lower_bound,
      agentTroopUpperBound: agent_troop_upper_bound,
    },
  } = config.config.troop;

  const calldata = {
    signer: config.account,
    damage_config: {
      t1_damage_value: t1_damage_value,
      t2_damage_multiplier: t2_damage_multiplier,
      t3_damage_multiplier: t3_damage_multiplier,
      damage_raid_percent_num: damage_raid_percent_num,
      damage_biome_bonus_num: damage_biome_bonus_num,
      damage_scaling_factor: damage_scaling_factor,
      damage_beta_small: damage_beta_small,
      damage_beta_large: damage_beta_large,
      damage_c0: damage_c0,
      damage_delta: damage_delta,
    },
    stamina_config: {
      stamina_gain_per_tick: stamina_gain_per_tick,
      stamina_initial: stamina_initial,
      stamina_bonus_value: stamina_bonus_value,
      stamina_knight_max: stamina_knight_max,
      stamina_paladin_max: stamina_paladin_max,
      stamina_crossbowman_max: stamina_crossbowman_max,
      stamina_attack_req: stamina_attack_req,
      stamina_attack_max: stamina_attack_max,
      stamina_explore_wheat_cost: stamina_explore_wheat_cost,
      stamina_explore_fish_cost: stamina_explore_fish_cost,
      stamina_explore_stamina_cost: stamina_explore_stamina_cost,
      stamina_travel_wheat_cost: stamina_travel_wheat_cost,
      stamina_travel_fish_cost: stamina_travel_fish_cost,
      stamina_travel_stamina_cost: stamina_travel_stamina_cost,
    },
    limit_config: {
      explorer_max_party_count: explorer_max_party_count,
      explorer_guard_max_troop_count: explorer_guard_max_troop_count,
      guard_resurrection_delay: guard_resurrection_delay,
      mercenaries_troop_lower_bound: mercenaries_troop_lower_bound,
      mercenaries_troop_upper_bound: mercenaries_troop_upper_bound,
      agent_troop_lower_bound: agent_troop_lower_bound,
      agent_troop_upper_bound: agent_troop_upper_bound,
    },
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Damage Configuration")}
    │  ${chalk.gray("T1 Damage Value:")}      ${chalk.white(calldata.damage_config.t1_damage_value)}
    │  ${chalk.gray("T2 Damage Multiplier:")}     ${chalk.white(calldata.damage_config.t2_damage_multiplier)}
    │  ${chalk.gray("T3 Damage Multiplier:")}    ${chalk.white(calldata.damage_config.t3_damage_multiplier)}
    │  ${chalk.gray("Damage Raid Percent:")}         ${chalk.white(calldata.damage_config.damage_raid_percent_num / 10_000)}%
    │  ${chalk.gray("Damage Biome Bonus:")}         ${chalk.white(calldata.damage_config.damage_biome_bonus_num)}
    │  ${chalk.gray("Damage Scaling Factor:")}         ${chalk.white(calldata.damage_config.damage_scaling_factor)}
    │  ${chalk.gray("Damage Beta Small:")}             ${chalk.white(calldata.damage_config.damage_beta_small)}
    │  ${chalk.gray("Damage Beta Large:")}             ${chalk.white(calldata.damage_config.damage_beta_large)}
    │  ${chalk.gray("Damage C0:")}             ${chalk.white(calldata.damage_config.damage_c0)}
    │  ${chalk.gray("Damage Delta:")}             ${chalk.white(calldata.damage_config.damage_delta)}
    │
    │  ${chalk.yellow("Stamina Configuration")}
    │  ${chalk.gray("Gain Per Tick:")}           ${chalk.white(calldata.stamina_config.stamina_gain_per_tick)}
    │  ${chalk.gray("Initial Stamina:")}         ${chalk.white(calldata.stamina_config.stamina_initial)}
    │  ${chalk.gray("Biome Bonus:")}             ${chalk.white(calldata.stamina_config.stamina_bonus_value)}
    │  ${chalk.gray("Knight Max Stamina:")}      ${chalk.white(calldata.stamina_config.stamina_knight_max)}
    │  ${chalk.gray("Paladin Max Stamina:")}     ${chalk.white(calldata.stamina_config.stamina_paladin_max)}
    │  ${chalk.gray("Crossbow Max Stamina:")}    ${chalk.white(calldata.stamina_config.stamina_crossbowman_max)}
    │  ${chalk.gray("Attack Requirement:")}       ${chalk.white(calldata.stamina_config.stamina_attack_req)}
    │  ${chalk.gray("Attack Max:")}              ${chalk.white(calldata.stamina_config.stamina_attack_max)}
    │  ${chalk.gray("Explore Wheat Cost:")}     ${chalk.white(calldata.stamina_config.stamina_explore_wheat_cost)}
    │  ${chalk.gray("Explore Fish Cost:")}        ${chalk.white(calldata.stamina_config.stamina_explore_fish_cost)}
    │  ${chalk.gray("Explore Stamina Cost:")}    ${chalk.white(calldata.stamina_config.stamina_explore_stamina_cost)}
    │  ${chalk.gray("Travel Wheat Cost:")}       ${chalk.white(calldata.stamina_config.stamina_travel_wheat_cost)}
    │  ${chalk.gray("Travel Fish Cost:")}        ${chalk.white(calldata.stamina_config.stamina_travel_fish_cost)}
    │  ${chalk.gray("Travel Stamina Cost:")}     ${chalk.white(calldata.stamina_config.stamina_travel_stamina_cost)}
    │
    │  ${chalk.yellow("Limit Configuration")}
    │  ${chalk.gray("Max Explorer Party:")}       ${chalk.white(calldata.limit_config.explorer_max_party_count)}
    │  ${chalk.gray("Max Explorer and Guard Troops:")}      ${chalk.white(calldata.limit_config.explorer_guard_max_troop_count)}
    │  ${chalk.gray("Guard Resurrection:")}       ${chalk.white(calldata.limit_config.guard_resurrection_delay)}
    │  ${chalk.gray("Mercenary Min:")}           ${chalk.white(calldata.limit_config.mercenaries_troop_lower_bound)}
    │  ${chalk.gray("Mercenary Max:")}           ${chalk.white(calldata.limit_config.mercenaries_troop_upper_bound)}
    │  ${chalk.gray("Agent Min:")}               ${chalk.white(calldata.limit_config.agent_troop_lower_bound)}
    │  ${chalk.gray("Agent Max:")}               ${chalk.white(calldata.limit_config.agent_troop_upper_bound)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_troop_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setupGlobals = async (config: Config) => {
  const bankCalldata = {
    signer: config.account,
    owner_fee_num: config.config.banks.ownerFeesNumerator,
    owner_fee_denom: config.config.banks.ownerFeesDenominator,
    lp_fee_num: config.config.banks.lpFeesNumerator,
    lp_fee_denom: config.config.banks.lpFeesDenominator,
  };
  console.log(
    chalk.cyan(`
  🌍 Global Configuration
  ═══════════════════════`),
  );

  // Bank Config
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Bank Parameters")}
    │  ${chalk.gray("LP Fee Rate:")}       ${chalk.white(`${bankCalldata.lp_fee_num}/${bankCalldata.lp_fee_denom}`)}
    │  ${chalk.gray("Owner Fee Rate:")}    ${chalk.white(`${bankCalldata.owner_fee_num}/${bankCalldata.owner_fee_denom}`)}
    └────────────────────────────────`),
  );

  const txBank = await config.provider.set_bank_config(bankCalldata);
  console.log(chalk.green(`    ✔ Bank configured `) + chalk.gray(txBank.statusReceipt));

  // Tick Configs

  const armiesTickCalldata = {
    signer: config.account,
    tick_interval_in_seconds: config.config.tick.armiesTickIntervalInSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Tick Intervals")}
    │  ${chalk.gray("Armies:")}            ${chalk.white(hourMinutesSeconds(armiesTickCalldata.tick_interval_in_seconds))}
    └────────────────────────────────`),
  );

  const txArmiesTick = await config.provider.set_tick_config(armiesTickCalldata);
  console.log(chalk.green(`    ✔ Armies tick configured `) + chalk.gray(txArmiesTick.statusReceipt));

  // Map Config
  const mapCalldata = {
    signer: config.account,
    reward_amount: config.config.exploration.reward,
    shards_mines_win_probability: config.config.exploration.shardsMinesWinProbability,
    shards_mines_fail_probability: config.config.exploration.shardsMinesFailProbability,
    agent_find_probability: config.config.exploration.agentFindProbability,
    agent_find_fail_probability: config.config.exploration.agentFindFailProbability,
    hyps_win_prob: config.config.exploration.hyperstructureWinProbAtCenter,
    hyps_fail_prob: config.config.exploration.hyperstructureFailProbAtCenter,
    hyps_fail_prob_increase_p_hex: config.config.exploration.hyperstructureFailProbIncreasePerHexDistance,
    hyps_fail_prob_increase_p_fnd: config.config.exploration.hyperstructureFailProbIncreasePerHyperstructureFound,
    mine_wheat_grant_amount: config.config.exploration.shardsMineInitialWheatBalance,
    mine_fish_grant_amount: config.config.exploration.shardsMineInitialFishBalance,
    quest_discovery_probability: config.config.exploration.questDiscoveryProbability,
    quest_discovery_fail_probability: config.config.exploration.questDiscoveryFailProbability,
  };

  const shardsMinesFailRate =
    (mapCalldata.shards_mines_fail_probability /
      (mapCalldata.shards_mines_fail_probability + mapCalldata.shards_mines_win_probability)) *
    100;
  const hyperstructureFailRateAtTheCenter =
    (mapCalldata.hyps_fail_prob / (mapCalldata.hyps_win_prob + mapCalldata.hyps_fail_prob)) * 100;
  const hyperstructureFailRateIncreasePerHex = (mapCalldata.hyps_fail_prob_increase_p_hex / 10_000) * 100;
  const hyperstructureFailRateIncreasePerHyperstructureFound =
    (mapCalldata.hyps_fail_prob_increase_p_fnd / (mapCalldata.hyps_win_prob + mapCalldata.hyps_fail_prob)) * 100;
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Map Parameters")}
    │  ${chalk.gray("Exploration Reward:")} ${chalk.white(mapCalldata.reward_amount)}
    │  ${chalk.gray("Shards Mines Fail Probability:")} ${chalk.white(shardsMinesFailRate) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability At The Center:")} ${chalk.white(hyperstructureFailRateAtTheCenter) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability Increase Per Hex:")} ${chalk.white(hyperstructureFailRateIncreasePerHex) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability Increase Per Hyperstructure Found:")} ${chalk.white(hyperstructureFailRateIncreasePerHyperstructureFound) + "%"}
    │  ${chalk.gray("Shards Mines Reward Fail Rate:")}     ${chalk.white(((mapCalldata.shards_mines_fail_probability / (mapCalldata.shards_mines_fail_probability + mapCalldata.shards_mines_win_probability)) * 100).toFixed(2) + "%")}
    │  ${chalk.gray("Shards Mine Initial Wheat Balance:")} ${chalk.white(mapCalldata.mine_wheat_grant_amount)}
    │  ${chalk.gray("Shards Mine Initial Fish Balance:")} ${chalk.white(mapCalldata.mine_fish_grant_amount)}
    │  ${chalk.gray("Quest Discovery Probability:")} ${chalk.white(mapCalldata.quest_discovery_probability)}
    │  ${chalk.gray("Quest Discovery Fail Probability:")} ${chalk.white(mapCalldata.quest_discovery_fail_probability)}
    └────────────────────────────────`),
  );

  const txMap = await config.provider.set_map_config(mapCalldata);
  console.log(chalk.green(`    ✔ Map configured `) + chalk.gray(txMap.statusReceipt));

  const questCalldata = {
    signer: config.account,
    quest_find_probability: config.config.exploration.questFindProbability,
    quest_find_fail_probability: config.config.exploration.questFindFailProbability,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Quest Parameters")}
    │  ${chalk.gray("Quest Find Probability:")} ${chalk.white(questCalldata.quest_find_probability)}
    │  ${chalk.gray("Quest Find Fail Probability:")} ${chalk.white(questCalldata.quest_find_fail_probability)}
    └────────────────────────────────`),
  );

  const txQuest = await config.provider.set_quest_config(questCalldata);
  console.log(chalk.green(`    ✔ Quest configured `) + chalk.gray(txQuest.statusReceipt));
};

export const setWonderBonusConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    within_tile_distance: config.config.wonderProductionBonus.within_tile_distance,
    bonus_percent_num: config.config.wonderProductionBonus.bonus_percent_num,
  };

  console.log(
    chalk.cyan(`
  🏰 Wonder Bonus Configuration
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Wonder Bonus")}
    │  ${chalk.gray("Within Tile Distance:")} ${chalk.white(calldata.within_tile_distance)}
    │  ${chalk.gray("Bonus Percent Num:")} ${chalk.white((calldata.bonus_percent_num / 10_000) * 100)}%
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_wonder_bonus_config(calldata);
  console.log(chalk.green(`    ✔ Wonder Bonus configured `) + chalk.gray(tx.statusReceipt));
};

export const setAgentConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    agent_controller: config.config.agent.controller_address,
    max_lifetime_count: config.config.agent.max_lifetime_count,
    max_current_count: config.config.agent.max_current_count,
    min_spawn_lords_amount: config.config.agent.min_spawn_lords_amount,
    max_spawn_lords_amount: config.config.agent.max_spawn_lords_amount,
  };

  console.log(
    chalk.cyan(`
  📦 Agent Controller Configuration
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Agent Config")}
    │  ${chalk.gray("Controller Address:")} ${chalk.white(calldata.agent_controller)}
    │  ${chalk.gray("Max Lifetime Count:")} ${chalk.white(calldata.max_lifetime_count)}
    │  ${chalk.gray("Max Current Count:")} ${chalk.white(calldata.max_current_count)}
    │  ${chalk.gray("Min Spawn Lords Amount:")} ${chalk.white(calldata.min_spawn_lords_amount)}
    │  ${chalk.gray("Max Spawn Lords Amount:")} ${chalk.white(calldata.max_spawn_lords_amount)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_agent_config(calldata);
  console.log(chalk.green(`\n    ✔ Agent Configurations set `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setVillageControllersConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    village_pass_nft_address: config.config.village.village_pass_nft_address,
    village_mint_initial_recipient: config.config.village.village_mint_initial_recipient,
  };

  console.log(
    chalk.cyan(`
  📦 Village Token Configuration
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Village Token Config")}
    │  ${chalk.gray("Village Pass Nft Address:")}         ${chalk.white(shortHexAddress(calldata.village_pass_nft_address))}
    │  ${chalk.gray("Village Pass Initial Mint Recipient:")}         ${chalk.white(shortHexAddress(calldata.village_mint_initial_recipient))}
    └────────────────────────────────`),
  );

  const villageTx = await config.provider.set_village_token_config(calldata);
  console.log(chalk.green(`\n    ✔ Village Controllers configured `) + chalk.gray(villageTx.statusReceipt) + "\n");
};

export const setCapacityConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    realm_capacity: config.config.carryCapacityGram[CapacityConfig.RealmStructure],
    village_capacity: config.config.carryCapacityGram[CapacityConfig.VillageStructure],
    hyperstructure_capacity: config.config.carryCapacityGram[CapacityConfig.HyperstructureStructure],
    fragment_mine_capacity: config.config.carryCapacityGram[CapacityConfig.FragmentMineStructure],
    bank_structure_capacity: config.config.carryCapacityGram[CapacityConfig.BankStructure],
    troop_capacity: config.config.carryCapacityGram[CapacityConfig.Army],
    donkey_capacity: config.config.carryCapacityGram[CapacityConfig.Donkey],
    storehouse_boost_capacity: config.config.carryCapacityGram[CapacityConfig.Storehouse],
  };

  console.log(
    chalk.cyan(`
  📦 Carry Capacity Configuration
  ═══════════════════════════════`),
  );

  const capacities = [
    { name: "Realm", value: calldata.realm_capacity },
    { name: "Village", value: calldata.village_capacity },
    { name: "Hyperstructure", value: calldata.hyperstructure_capacity },
    { name: "Fragment Mine", value: calldata.fragment_mine_capacity },
    { name: "Bank", value: calldata.bank_structure_capacity },
    { name: "Troops", value: calldata.troop_capacity },
    { name: "Donkeys", value: calldata.donkey_capacity },
    {
      name: "Storehouse Added Capacity Per Building",
      value: calldata.storehouse_boost_capacity,
    },
  ];

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Max Weight Per Category")}${capacities
      .map(
        ({ name, value }) => `
    │  ${chalk.gray(name.padEnd(12))} ${chalk.white(addCommas(BigInt(value)))} ${chalk.gray("grams")} 
    │  ${chalk.gray("").padEnd(12)} ${chalk.gray("i.e (")} ${chalk.white(addCommas(BigInt(value) / BigInt(1000)))} ${chalk.gray("kg")} ${chalk.gray(")")}`,
      )
      .join("")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_capacity_config(calldata);
  console.log(chalk.green(`\n    ✔ Capacity configured `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setTradeConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    max_count: config.config.trade.maxCount,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Trade Configuration")}
    │  ${chalk.gray("Max Count:")} ${chalk.white(calldata.max_count)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_trade_config(calldata);
  console.log(chalk.green(`\n    ✔ Trade configured `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setSeasonConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🎮 Season Configuration
  ═══════════════════════`),
  );

  const now = Math.floor(new Date().getTime() / 1000);
  const startMainAt = now + config.config.season.startMainAfterSeconds;
  const startSettlingAt = now + config.config.season.startSettlingAfterSeconds;

  const seasonCalldata = {
    signer: config.account,
    season_pass_address: config.config.setup!.addresses.seasonPass,
    realms_address: config.config.setup!.addresses.realms,
    lords_address: config.config.setup!.addresses.lords,
    start_settling_at: startSettlingAt,
    start_main_at: startMainAt,
    end_grace_seconds: config.config.season.bridgeCloseAfterEndSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Season Parameters")}
    │  ${chalk.gray("Start Setting Time:")}   ${chalk.white(
      new Date(seasonCalldata.start_settling_at * 1000).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    )} UTC
    │  ${chalk.gray("Start Main Game Time:")}   ${chalk.white(
      new Date(seasonCalldata.start_main_at * 1000).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    )} UTC
    │  ${chalk.gray("Bridge Closes:")}   ${chalk.white(hourMinutesSeconds(seasonCalldata.end_grace_seconds))} after game ends
    │
    │  ${chalk.yellow("Contract Addresses")}
    │  ${chalk.gray("Season Pass:")}       ${chalk.white(shortHexAddress(seasonCalldata.season_pass_address))}
    │  ${chalk.gray("Realms:")}            ${chalk.white(shortHexAddress(seasonCalldata.realms_address))}
    │  ${chalk.gray("LORDS:")}             ${chalk.white(shortHexAddress(seasonCalldata.lords_address))}
    └────────────────────────────────`),
  );

  const setSeasonTx = await config.provider.set_season_config(seasonCalldata);
  console.log(chalk.green(`    ✔ Season configured `) + chalk.gray(setSeasonTx.statusReceipt));
};

export const setVRFConfig = async (config: Config) => {
  if (config.config.setup?.chain !== "mainnet" && config.config.setup?.chain !== "sepolia") {
    console.log(chalk.yellow("    ⚠ Skipping VRF configuration for slot or local environment"));
    return;
  }

  console.log(
    chalk.cyan(`
  🎲 VRF Configuration
  ═══════════════════════`),
  );

  if (BigInt(config.config.vrf.vrfProviderAddress) === BigInt(0)) {
    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow("Status")}
    │  ${chalk.gray("Provider:")}          ${chalk.red("Not configured")}
    └────────────────────────────────`),
    );
    return;
  }

  const vrfCalldata = {
    signer: config.account,
    vrf_provider_address: config.config.vrf.vrfProviderAddress,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("VRF Provider")}
    │  ${chalk.gray("Address:")}           ${chalk.white(shortHexAddress(vrfCalldata.vrf_provider_address))}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_vrf_config(vrfCalldata);
  console.log(chalk.green(`    ✔ VRF configured `) + chalk.gray(tx.statusReceipt) + "\n");
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
    realm_fee_dpt_percent: config.config.bridge.realm_fee_dpt_percent,
    realm_fee_wtdr_percent: config.config.bridge.realm_fee_wtdr_percent,
  };
  console.log(
    chalk.cyan(`
  🌉 Bridge Fees Configuration
  ══════════════════════════`),
  );

  const fees = {
    deposits: {
      "veLORDS Deposit": (bridgeFeesCalldata.velords_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Season Pool Deposit": (bridgeFeesCalldata.season_pool_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Client Deposit": (bridgeFeesCalldata.client_fee_on_dpt_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Max Realm Fee on Deposit By Village":
        (bridgeFeesCalldata.realm_fee_dpt_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
    },
    withdrawals: {
      "veLORDS Withdraw": (bridgeFeesCalldata.velords_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Season Pool Withdraw": (bridgeFeesCalldata.season_pool_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Client Withdraw": (bridgeFeesCalldata.client_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Max Realm Fee on Withdrawal By Village":
        (bridgeFeesCalldata.realm_fee_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
    },
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Deposit Fee Structure")}${Object.entries(fees.deposits)
      .map(
        ([name, value]) => `
    │  ${chalk.gray(name.padEnd(20))} ${chalk.white(value)}`,
      )
      .join("")}
    │
    │  ${chalk.yellow("Withdrawal Fee Structure")}${Object.entries(fees.withdrawals)
      .map(
        ([name, value]) => `
    │  ${chalk.gray(name.padEnd(20))} ${chalk.white(value)}`,
      )
      .join("")}
    │
    │  ${chalk.yellow("Recipients")}
    │  ${chalk.gray("veLORDS:")}          ${chalk.white(shortHexAddress(config.config.bridge.velords_fee_recipient.toString()))}
    │  ${chalk.gray("Season Pool:")}      ${chalk.white(shortHexAddress(config.config.bridge.season_pool_fee_recipient.toString()))}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_resource_bridge_fees_config(bridgeFeesCalldata);
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setSpeedConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏃 Movement Speed Configuration
  ════════════════════════════`),
  );

  const donkeySpeed = config.config.speed.donkey;
  const donkeyCalldata = {
    signer: config.account,
    sec_per_km: donkeySpeed,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Donkey Travel Speed")}
    │  ${chalk.gray("Speed:")} ${chalk.white(donkeySpeed.toString())} ${chalk.gray("seconds/km")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_donkey_speed_config(donkeyCalldata);
  console.log(chalk.green(` ✔ Donkey speed configured `) + chalk.gray(tx.statusReceipt));
};

export const setHyperstructureConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏛️  Hyperstructure Configuration
  ═══════════════════════════════`),
  );

  const {
    hyperstructurePointsPerCycle,
    hyperstructureConstructionCost,
    hyperstructurePointsForWin,
    hyperstructureInitializationShardsCost,
  } = config.config.hyperstructures;

  const initializationShardsAmount = hyperstructureInitializationShardsCost.amount;
  const hyperstructureCalldata = {
    signer: config.account,
    initialize_shards_amount: initializationShardsAmount * config.config.resources.resourcePrecision,
    construction_resources: hyperstructureConstructionCost,
    points_per_second: hyperstructurePointsPerCycle,
    points_for_win: hyperstructurePointsForWin,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Hyperstructure Points System")}
    │  ${chalk.gray("Per Second:")}        ${chalk.white(addCommas(hyperstructureCalldata.points_per_second))}
    │  ${chalk.gray("For Win:")}          ${chalk.white(addCommas(hyperstructureCalldata.points_for_win))}
    │
    │  ${chalk.gray("Initialization Shards:")}     ${chalk.white(inGameAmount(hyperstructureCalldata.initialize_shards_amount, config.config))}
    │
    │  ${chalk.gray("Construction Cost")}${hyperstructureCalldata.construction_resources
      .map(
        (c) => `
    │  ${chalk.yellow(ResourcesIds[c.resource_type].padEnd(12))} ${chalk.white(c.min_amount)} ${chalk.gray("to")} ${chalk.white(c.max_amount)}`,
      )
      .join("")}
    └────────────────────────────────`),
  );
  const tx = await config.provider.set_hyperstructure_config(hyperstructureCalldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setSettlementConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏘️  Settlement Configuration
  ═══════════════════════════`),
  );

  const { center, base_distance, subsequent_distance } = config.config.settlement;

  const calldata = {
    signer: config.account,
    center,
    base_distance,
    subsequent_distance,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Layout Parameters")}
    │  ${chalk.gray("Center:")}            ${chalk.white(`(${calldata.center}, ${calldata.center})`)}
    │  ${chalk.gray("Base Distance:")}     ${chalk.white(calldata.base_distance)}
    │  ${chalk.gray("Subsequent Distance:")}   ${chalk.white(calldata.subsequent_distance)}
    │
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_settlement_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const createBanks = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏦 Bank Creation
  ═══════════════════════`),
  );

  const banks = [];
  const bank_coords = [];
  // Find coordinates x steps from center in each direction
  const stepsFromCenter = 220;
  const distantCoordinates = HexGrid.findHexCoordsfromCenter(stepsFromCenter);
  for (const [_, coord] of Object.entries(distantCoordinates)) {
    bank_coords.push({ x: coord.x, y: coord.y });
  }

  for (let i = 0; i < config.config.banks.maxNumBanks; i++) {
    banks.push({
      name: `${config.config.banks.name} ${i + 1}`,
      coord: bank_coords[i],
    });
  }

  const calldata = {
    signer: config.account,
    banks,
  };

  for (const bank of calldata.banks) {
    console.log("\n");
    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow("Bank Parameters")}
    │  ${chalk.gray("Name:")}              ${chalk.white(bank.name)}
    │  ${chalk.gray("Location:")}          ${chalk.white(`(${bank.coord.x}, ${bank.coord.y})`)}
    └────────────────────────────────`),
    );
  }

  const tx = await config.provider.create_banks(calldata);
  console.log(chalk.green(`\n    ✔ Banks created successfully `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const mintResources = async (config: Config) => {
  console.log(
    chalk.cyan(`
  💰 Minting Resources
  ══════════════════════════`),
  );

  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;
  const ammResourceIds = Object.keys(ammStartingLiquidity).map(Number);
  const totalResourceCount = ammResourceIds.length;

  // Mint LORDS
  const lordsAmount = config.config.resources.resourcePrecision * lordsLiquidityPerResource * totalResourceCount;
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Minting LORDS")}
    │  ${chalk.gray("Amount:")} ${chalk.white(inGameAmount(lordsAmount, config.config))}
    │  ${chalk.gray("To:")} ${chalk.white(`Bank #${ADMIN_BANK_ENTITY_ID}`)}
    └────────────────────────────────`),
  );

  await config.provider.mint_resources({
    signer: config.account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources: [ResourcesIds.Lords, lordsAmount],
  });

  // Mint other resources
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Minting Resources")}`),
  );

  const resources = ammResourceIds.flatMap((resourceId) => {
    const amount =
      ammStartingLiquidity[resourceId as keyof typeof ammStartingLiquidity]! *
      config.config.resources.resourcePrecision;
    console.log(
      chalk.cyan(
        `    │  ${chalk.gray(ResourcesIds[resourceId].padEnd(12))} ${chalk.white(inGameAmount(amount, config.config))}`,
      ),
    );
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

// This function mints and adds liquidity to the bank
export const addLiquidity = async (config: Config) => {
  console.log(
    chalk.cyan(`
  💧 Adding Initial Liquidity
  ══════════════════════════`),
  );

  const { ammStartingLiquidity, lordsLiquidityPerResource } = config.config.banks;
  const calls = [];

  for (const [resourceId, amount] of Object.entries(ammStartingLiquidity)) {
    const resourceAmount = amount * config.config.resources.resourcePrecision;
    const lordsAmount = lordsLiquidityPerResource * config.config.resources.resourcePrecision;

    const calldata = {
      resource_type: resourceId,
      resource_amount: resourceAmount,
      lords_amount: lordsAmount,
    };

    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[calldata.resource_type as keyof typeof ResourcesIds])} Pool
    │  ${chalk.gray("Resource Amount:")} ${chalk.white(inGameAmount(calldata.resource_amount, config.config))}
    │  ${chalk.gray("LORDS Amount:")}    ${chalk.white(inGameAmount(calldata.lords_amount, config.config))}
    └────────────────────────────────`),
    );

    calls.push(calldata);
  }

  try {
    const tx = await config.provider.add_initial_bank_liquidity({
      signer: config.account,
      bank_entity_id: ADMIN_BANK_ENTITY_ID,
      entity_id: ADMIN_BANK_ENTITY_ID,
      calls,
    });
    console.log(chalk.green(`\n    ✔ Liquidity added successfully `) + chalk.gray(tx.statusReceipt) + "\n");
  } catch (e) {
    console.log(chalk.red(`\n    ✖ Failed to add liquidity: `) + chalk.gray(e) + "\n");
  }
};

export const nodeReadConfig = async (chain: Chain) => {
  try {
    let path = "./environments/data";
    switch (chain) {
      case "sepolia":
        path += "/sepolia.json"; // as any to avoid type errors
        break;
      case "mainnet":
        path += "/mainnet.json";
        break;
      case "slot":
        path += "/slot.json";
        break;
      case "local":
        path += "/local.json";
        break;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }

    const config = JSON.parse(fs.readFileSync(path, "utf8"));
    return config.configuration as any; // as any to avoid type errors
  } catch (error) {
    throw new Error(`Failed to load configuration for chain ${chain}: ${error}`);
  }
};
