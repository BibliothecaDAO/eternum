import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  BuildingType,
  CapacityConfig,
  EternumProvider,
  HexGrid,
  ResourcesIds,
  ResourceTier,
  scaleResourceCostMinMax,
  scaleResourceInputs,
  scaleResourceOutputs,
  scaleResourceProductionByLaborParams,
  scaleResources,
  type Config as EternumConfig,
  type ResourceInputs,
  type ResourceOutputs,
  type ResourceWhitelistConfig,
} from "@bibliothecadao/eternum";

import chalk from "chalk";

import fs from "fs";
import { Account } from "starknet";
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
    // await this.setupBank(account, provider);
  }

  async setupNonBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await setWorldConfig(config);
    await setProductionConfig(config);
    await setResourceBridgeWhitelistConfig(config);
    await setTradeConfig(config);
    await setStartingResourcesConfig(config);
    await setSeasonConfig(config);
    await setVRFConfig(config);
    await setResourceBridgeFeesConfig(config);
    await setBuildingCategoryPopConfig(config);
    await setPopulationConfig(config);
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
    await setBuildingGeneralConfig(config);
    await setSettlementConfig(config);
  }

  async setupBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await createBanks(config);
    await mintResources(config);
    await addLiquidity(config);
  }

  getResourceBuildingCostsScaled(): ResourceInputs {
    return scaleResourceInputs(
      this.globalConfig.buildings.resourceBuildingCosts,
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
      this.globalConfig.buildings.otherBuildingCosts,
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

export const setStartingResourcesConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏆 Starting Resources Configuration 
  ═══════════════════════════════`),
  );

  const calldataArray = [];
  for (const elem of Object.values(config.config.startingResources)) {
    const calldata = {
      resource: elem.resource,
      amount: elem.amount * config.config.resources.resourcePrecision,
    };

    console.log(
      chalk.cyan(`
    ✧ Resource ${chalk.yellow(ResourcesIds[calldata.resource])}:`),
    );

    console.log(chalk.cyan(`      ∙ ${chalk.cyan(inGameAmount(calldata.amount, config.config))}`));

    calldataArray.push(calldata);
  }

  const tx = await config.provider.set_starting_resources_config({
    signer: config.account,
    startingResources: calldataArray,
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

  const tx = await config.provider.set_world_config({
    signer: config.account,
    admin_address: config.account.address,
  });

  console.log(
    chalk.cyan(`
    ${chalk.green("✨ Configuration successfully deployed")}
    ${chalk.gray("Transaction:")} ${chalk.white(tx.statusReceipt)}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `),
  );
};

export const setProductionConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  ⚡ RESOURCE PRODUCTION CONFIGURATION ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`),
  );

  const calldataArray = [];
  const scaledResourceInputs = scaleResourceInputs(
    config.config.resources.resourceInputs,
    config.config.resources.resourcePrecision,
  );
  const scaledResourceOutputs = scaleResourceOutputs(
    config.config.resources.resourceOutputs,
    config.config.resources.resourcePrecision,
  );

  const scaledResourceProductionByLaborParams = scaleResourceProductionByLaborParams(
    config.config.resources.resourceProductionByLaborParams,
    config.config.resources.resourcePrecision,
  );

  for (const resourceId of Object.keys(scaledResourceInputs) as unknown as ResourcesIds[]) {
    const outputAmountPerBuildingPerTick = scaledResourceOutputs[resourceId];
    const predefinedResourceBurnCost = scaledResourceInputs[resourceId];
    const resourceProductionByLaborParams = scaledResourceProductionByLaborParams[resourceId];
    const calldata = {
      resource_type: resourceId,
      realm_output_per_tick: outputAmountPerBuildingPerTick,
      village_output_per_tick: outputAmountPerBuildingPerTick / 2,
      predefined_resource_burn_cost: predefinedResourceBurnCost,
      labor_burn_strategy: resourceProductionByLaborParams,
    };

    calldataArray.push(calldata);

    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[calldata.resource_type])}
    │  ${chalk.gray(`${ResourcesIds[calldata.resource_type]} produced per tick, per building for realm:`)} ${chalk.white(`${inGameAmount(calldata.realm_output_per_tick, config.config)} ${chalk.yellow(ResourcesIds[calldata.resource_type])}`)}
    │  ${chalk.gray(`${ResourcesIds[calldata.resource_type]} produced per tick, per building for village:`)} ${chalk.white(`${inGameAmount(calldata.village_output_per_tick, config.config)} ${chalk.yellow(ResourcesIds[calldata.resource_type])}`)}
    │  ${chalk.gray(`Using Labor Burn Production Strategy:`)}
    │     ${chalk.gray(``)} ${
      calldata.labor_burn_strategy.resource_rarity === 0
        ? chalk.red("Cannot be produced with labor")
        : `
    │     ${chalk.gray(`Resource Rarity:`)} ${chalk.white(` ${calldata.labor_burn_strategy.resource_rarity}`)}
    │     ${chalk.gray(`Depreciation Rate:`)} ${chalk.white(` ${(calldata.labor_burn_strategy.depreciation_percent_num / calldata.labor_burn_strategy.depreciation_percent_denom) * 100}%`)}
    │     ${chalk.gray(`Wheat Burn Per Labor:`)} ${chalk.white(inGameAmount(calldata.labor_burn_strategy.wheat_burn_per_labor, config.config))}
    │     ${chalk.gray(`Fish Burn Per Labor:`)} ${chalk.white(inGameAmount(calldata.labor_burn_strategy.fish_burn_per_labor, config.config))}`
    }
    │  ${chalk.gray(``)}
    │  ${chalk.gray(`Using Multiple Resource Burn Production Strategy:`)}
    │  ${
      calldata.predefined_resource_burn_cost.length > 0
        ? chalk.gray(` Cost of producing 1 ${ResourcesIds[calldata.resource_type]}:`) +
          calldata.predefined_resource_burn_cost
            .map(
              (c) => `
    │       ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`,
            )
            .join("")
        : `    ${chalk.blue("Can't be produced with multiple resources")}`
    }
    └────────────────────────────────`),
    );
  }

  const tx = await config.provider.set_production_config({ signer: config.account, calls: calldataArray });

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

  let resourceWhitelistConfigs: ResourceWhitelistConfig[] = [];
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

export const setBuildingCategoryPopConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  👥 Building Population Configuration
  ══════════════════════════════════`),
  );

  const calldataArray: { building_category: BuildingType; population: number; capacity: number }[] = [];
  const buildingPopulation = config.config.buildings.buildingPopulation;
  const buildingCapacity = config.config.buildings.buildingCapacity;

  for (const buildingId of Object.keys(buildingPopulation) as unknown as BuildingType[]) {
    if (buildingPopulation[buildingId] !== 0 || buildingCapacity[buildingId] !== 0) {
      const calldata = {
        building_category: buildingId,
        population: buildingPopulation[buildingId] ?? 0,
        capacity: buildingCapacity[buildingId] ?? 0,
      };

      console.log(
        chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[calldata.building_category])}
    │  ${chalk.gray("Consumes")} ${chalk.white(calldata.population)} ${chalk.gray("population")}
    │  ${chalk.gray("Adds")} ${chalk.white(calldata.capacity)} ${chalk.gray("capacity")}
    └────────────────────────────────`),
      );

      calldataArray.push(calldata);
    }
  }

  const tx = await config.provider.set_building_category_pop_config({
    signer: config.account,
    calls: calldataArray,
  });

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setPopulationConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    base_population: config.config.populationCapacity.basePopulation,
  };

  console.log(
    chalk.cyan(`
  👥 Population Configuration
  ══════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Base Parameters")}
    │  ${chalk.gray("Starting Population:")}    ${chalk.white(calldata.base_population)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_population_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setBuildingGeneralConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    base_cost_percent_increase: config.config.buildings.buildingFixedCostScalePercent,
  };

  console.log(
    chalk.cyan(`
  🏗️  Building General Configuration
  ══════════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Cost Parameters")}
    │  ${chalk.gray("Base Cost Increase:")}    ${chalk.white((calldata.base_cost_percent_increase / 10_000) * 100 + "%")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_building_general_config(calldata);

  console.log(chalk.green(`\n   ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setBuildingConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏗️  Building Configuration
  ═══════════════════════════`),
  );

  const calldataArray = [];
  const buildingResourceProduced = config.config.buildings.buildingResourceProduced;
  const buildingCosts = config.config.buildings.otherBuildingCosts;
  const scaledOtherBuildingCosts = scaleResourceInputs(buildingCosts, config.config.resources.resourcePrecision);
  const BUILDING_COST_DISPLAY_ROWS = 6;

  // Non Resource Building Config
  for (const buildingId of Object.keys(buildingResourceProduced) as unknown as BuildingType[]) {
    if (scaledOtherBuildingCosts[buildingId].length !== 0) {
      const costs = scaledOtherBuildingCosts[buildingId];
      const calldata = {
        building_category: buildingId,
        building_resource_type: buildingResourceProduced[buildingId] as ResourcesIds,
        cost_of_building: costs,
      };
      calldataArray.push(calldata);

      // buildingScalePercent only used for display logic. not part of the calldata
      const buildingScalePercent = config.config.buildings.buildingFixedCostScalePercent;
      console.log(
        chalk.cyan(`
    ┌─ ${chalk.yellow(BuildingType[buildingId])}
    │  ${chalk.gray("Produces:")} ${chalk.white(ResourcesIds[calldata.building_resource_type as ResourcesIds])}
    │  ${chalk.gray("Building Costs (with ")}${chalk.white((buildingScalePercent / 10_000) * 100 + "%")}${chalk.gray(" increase per building):")}
    │  
    │  ${chalk.gray("┌──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}
    │  ${chalk.gray("│")} Building ${calldata.cost_of_building.map((c) => chalk.white(ResourcesIds[c.resource].padEnd(12))).join("")}
    │  ${chalk.gray("├──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}${Array.from(
      { length: BUILDING_COST_DISPLAY_ROWS },
      (_, i) => {
        const buildingNum = i + 1;
        const costsStr = calldata.cost_of_building
          .map((c) => {
            const multiplier = Math.pow(1 + buildingScalePercent / 10_000, buildingNum - 1);
            return chalk.white(inGameAmount(c.amount * multiplier, config.config).padEnd(12));
          })
          .join("");
        return `
    │  ${chalk.yellow(("No #" + buildingNum).padEnd(8))}${chalk.gray("│")} ${costsStr}`;
      },
    ).join("")}
    │  ${chalk.gray("└──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}
    └────────────────────────────────`),
      );
    }
  }

  // Resource Building Config
  const scaledResourceBuildingCosts = scaleResourceInputs(
    config.config.buildings.resourceBuildingCosts,
    config.config.resources.resourcePrecision,
  );
  for (const resourceId of Object.keys(scaledResourceBuildingCosts) as unknown as ResourcesIds[]) {
    const costs = scaledResourceBuildingCosts[resourceId];
    const calldata = {
      building_category: BuildingType.Resource,
      building_resource_type: resourceId,
      cost_of_building: costs,
    };

    const buildingScalePercent = config.config.buildings.buildingFixedCostScalePercent;
    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(ResourcesIds[resourceId])} Building
    │  ${chalk.gray("Produces:")} ${chalk.white(ResourcesIds[calldata.building_resource_type as ResourcesIds])}
    │  ${chalk.gray("Building Costs:")}${costs
      .map(
        (c) => `
    │     ${chalk.white(`${inGameAmount(c.amount, config.config)} ${ResourcesIds[c.resource]}`)}`,
      )
      .join("")}

    │  ${chalk.gray("┌──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}
    │  ${chalk.gray("│")} Building ${calldata.cost_of_building.map((c) => chalk.white(ResourcesIds[c.resource].padEnd(12))).join("")}
    │  ${chalk.gray("├──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}${Array.from(
      { length: BUILDING_COST_DISPLAY_ROWS },
      (_, i) => {
        const buildingNum = i + 1;
        const costsStr = calldata.cost_of_building
          .map((c) => {
            const multiplier = Math.pow(1 + buildingScalePercent / 10_000, buildingNum - 1);
            return chalk.white(inGameAmount(c.amount * multiplier, config.config).padEnd(12));
          })
          .join("");
        return `
    │  ${chalk.yellow(("No #" + buildingNum).padEnd(8))}${chalk.gray("│")} ${costsStr}`;
      },
    ).join("")}
    │  ${chalk.gray("└──────────")}${calldata.cost_of_building.map((c) => "─".repeat(12)).join("")}
    └────────────────────────────────`),
    );

    calldataArray.push(calldata);
  }

  const tx = await config.provider.set_building_config({ signer: config.account, calls: calldataArray });
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
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

  const tx = await config.provider.set_structure_level_config({ signer: config.account, calls: calldataArray });
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
    │  ${chalk.gray("Regular Immunity:")}      ${chalk.white(calldata.regular_immunity_ticks + " ticks")}
    │  ${chalk.gray("Structure Immunity:")}    ${chalk.white(calldata.hyperstructure_immunity_ticks + " ticks")}
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
    },
  } = config.config.troop;

  const calldata = {
    signer: config.account,
    damage_config: {
      t1_damage_value: t1_damage_value,
      t2_damage_multiplier: t2_damage_multiplier,
      t3_damage_multiplier: t3_damage_multiplier,
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
    },
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Damage Configuration")}
    │  ${chalk.gray("T1 Damage Value:")}      ${chalk.white(calldata.damage_config.t1_damage_value)}
    │  ${chalk.gray("T2 Damage Multiplier:")}     ${chalk.white(calldata.damage_config.t2_damage_multiplier)}
    │  ${chalk.gray("T3 Damage Multiplier:")}    ${chalk.white(calldata.damage_config.t3_damage_multiplier)}
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
    hyps_win_prob: config.config.exploration.hyperstructureWinProbAtCenter,
    hyps_fail_prob: config.config.exploration.hyperstructureFailProbAtCenter,
    hyps_fail_prob_increase_p_hex: config.config.exploration.hyperstructureFailProbIncreasePerHexDistance,
    hyps_fail_prob_increase_p_fnd: config.config.exploration.hyperstructureFailProbIncreasePerHyperstructureFound,
    mine_wheat_grant_amount: config.config.exploration.shardsMineInitialWheatBalance,
    mine_fish_grant_amount: config.config.exploration.shardsMineInitialFishBalance,
  };

  let shardsMinesFailRate =
    (mapCalldata.shards_mines_fail_probability /
      (mapCalldata.shards_mines_fail_probability + mapCalldata.shards_mines_win_probability)) *
    100;
  let hyperstructureFailRateAtTheCenter =
    (mapCalldata.hyps_fail_prob / (mapCalldata.hyps_win_prob + mapCalldata.hyps_fail_prob)) * 100;
  let hyperstructureFailRateIncreasePerHex =
    (mapCalldata.hyps_fail_prob_increase_p_hex / (mapCalldata.hyps_win_prob + mapCalldata.hyps_fail_prob)) * 100;
  let hyperstructureFailRateIncreasePerHyperstructureFound =
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
    └────────────────────────────────`),
  );

  const txMap = await config.provider.set_map_config(mapCalldata);
  console.log(chalk.green(`    ✔ Map configured `) + chalk.gray(txMap.statusReceipt));
};

export const setCapacityConfig = async (config: Config) => {
  const calldata = {
    signer: config.account,
    structure_capacity: config.config.carryCapacityGram[CapacityConfig.Structure],
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
    { name: "Structure", value: calldata.structure_capacity },
    { name: "Troops", value: calldata.troop_capacity },
    { name: "Donkeys", value: calldata.donkey_capacity },
    { name: "Storehouse Added Capacity Per Building", value: calldata.storehouse_boost_capacity },
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
  const startAt = now + config.config.season.startAfterSeconds;

  const seasonCalldata = {
    signer: config.account,
    season_pass_address: config.config.setup!.addresses.seasonPass,
    realms_address: config.config.setup!.addresses.realms,
    lords_address: config.config.setup!.addresses.lords,
    start_at: startAt,
  };

  const seasonBridgeCalldata = {
    signer: config.account,
    close_after_end_seconds: config.config.season.bridgeCloseAfterEndSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Season Parameters")}
    │  ${chalk.gray("Start Time:")}   ${chalk.white(
      new Date(seasonCalldata.start_at * 1000).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    )} UTC
    │  ${chalk.gray("Bridge Closes:")}   ${chalk.white(hourMinutesSeconds(seasonBridgeCalldata.close_after_end_seconds))} after game ends
    │
    │  ${chalk.yellow("Contract Addresses")}
    │  ${chalk.gray("Season Pass:")}       ${chalk.white(shortHexAddress(seasonCalldata.season_pass_address))}
    │  ${chalk.gray("Realms:")}            ${chalk.white(shortHexAddress(seasonCalldata.realms_address))}
    │  ${chalk.gray("LORDS:")}             ${chalk.white(shortHexAddress(seasonCalldata.lords_address))}
    └────────────────────────────────`),
  );

  const setSeasonTx = await config.provider.set_season_config(seasonCalldata);
  const setSeasonBridgeTx = await config.provider.set_season_bridge_config(seasonBridgeCalldata);

  console.log(chalk.green(`    ✔ Season configured `) + chalk.gray(setSeasonTx.statusReceipt));
  console.log(chalk.green(`    ✔ Bridge configured `) + chalk.gray(setSeasonBridgeTx.statusReceipt) + "\n");
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
    max_bank_fee_dpt_percent: config.config.bridge.max_bank_fee_dpt_percent,
    max_bank_fee_wtdr_percent: config.config.bridge.max_bank_fee_wtdr_percent,
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
      "Max Bank Fee on Deposit": (bridgeFeesCalldata.max_bank_fee_dpt_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
    },
    withdrawals: {
      "veLORDS Withdraw": (bridgeFeesCalldata.velords_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Season Pool Withdraw": (bridgeFeesCalldata.season_pool_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Client Withdraw": (bridgeFeesCalldata.client_fee_on_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
      "Max Bank Fee on Withdraw": (bridgeFeesCalldata.max_bank_fee_wtdr_percent / BRIDGE_FEE_DENOMINATOR) * 100 + "%",
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
    hyperstructurePointsOnCompletion,
    hyperstructureTimeBetweenSharesChangeSeconds,
    hyperstructurePointsForWin,
    hyperstructureTotalCosts,
  } = config.config.hyperstructures;

  const costs = scaleResourceCostMinMax(hyperstructureTotalCosts, config.config.resources.resourcePrecision);

  const hyperstructureCalldata = {
    signer: config.account,
    resources_for_completion: costs,
    time_between_shares_change: hyperstructureTimeBetweenSharesChangeSeconds,
    points_per_cycle: hyperstructurePointsPerCycle,
    points_for_win: hyperstructurePointsForWin,
    points_on_completion: hyperstructurePointsOnCompletion,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Points System")}
    │  ${chalk.gray("Per Cycle:")}        ${chalk.white(addCommas(hyperstructureCalldata.points_per_cycle))}
    │  ${chalk.gray("On Completion:")}    ${chalk.white(addCommas(hyperstructureCalldata.points_on_completion))}
    │  ${chalk.gray("For Win:")}          ${chalk.white(addCommas(hyperstructureCalldata.points_for_win))}
    │
    │  ${chalk.yellow("Timing")}
    │  ${chalk.gray("Minimum Time Between Share Changes:")}     ${chalk.white(hourMinutesSeconds(hyperstructureCalldata.time_between_shares_change))}
    │
    │  ${chalk.yellow("Resource Tier")}${hyperstructureCalldata.resources_for_completion
      .map(
        (c) => `
    │  ${chalk.gray(ResourceTier[c.resource_tier].padEnd(12))} ${chalk.white(inGameAmount(c.min_amount, config.config))} ${chalk.gray("to")} ${chalk.white(inGameAmount(c.max_amount, config.config))}`,
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
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Layout Parameters")}
    │  ${chalk.gray("Center:")}            ${chalk.white(`(${calldata.center}, ${calldata.center})`)}
    │  ${chalk.gray("Base Distance:")}     ${chalk.white(calldata.base_distance)}
    │  ${chalk.gray("Min First Layer:")}   ${chalk.white(calldata.min_first_layer_distance)}
    │
    │  ${chalk.yellow("Current State")}
    │  ${chalk.gray("Points Placed:")}     ${chalk.white(calldata.points_placed)}
    │  ${chalk.gray("Current Layer:")}     ${chalk.white(calldata.current_layer)}
    │  ${chalk.gray("Current Side:")}      ${chalk.white(calldata.current_side)}
    │  ${chalk.gray("Point on Side:")}     ${chalk.white(calldata.current_point_on_side)}
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

  let banks = [];
  let bank_coords = [];
  // Find coordinates x steps from center in each direction
  const stepsFromCenter = 80;
  const distantCoordinates = HexGrid.findHexCoordsfromCenter(stepsFromCenter);
  for (const [_, coord] of Object.entries(distantCoordinates)) {
    bank_coords.push({ x: coord.x, y: coord.y });
  }

  for (let i = 0; i < config.config.banks.maxNumBanks; i++) {
    banks.push({
      name: `${config.config.banks.name} ${i + 1}`,
      coord: bank_coords[i],
      guard_slot: 0, // delta
      troop_tier: 1, // T2
      troop_type: 2, // Crossbowman
    });
  }

  let calldata = {
    signer: config.account,
    banks,
  };

  let guard_slot_names = ["Delta", "Charlie", "Bravo", "Alpha"];
  let troop_tier_names = ["T1", "T2", "T3"];
  let troop_type_names = ["Knight", "Paladin", "Crossbowman"];

  for (const bank of calldata.banks) {
    console.log("\n");
    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow("Bank Parameters")}
    │  ${chalk.gray("Name:")}              ${chalk.white(bank.name)}
    │  ${chalk.gray("Location:")}          ${chalk.white(`(${bank.coord.x}, ${bank.coord.y})`)}
    │  ${chalk.gray("Guard Slot:")}        ${chalk.white(guard_slot_names[bank.guard_slot])}
    │  ${chalk.gray("Troop Tier:")}        ${chalk.white(troop_tier_names[bank.troop_tier])}
    │  ${chalk.gray("Troop Type:")}        ${chalk.white(troop_type_names[bank.troop_type])}
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

export const addLiquidity = async (config: Config) => {
  console.log(
    chalk.cyan(`
  💧 Adding Initial Liquidity
  ══════════════════════════`),
  );

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
    const tx = await config.provider.add_liquidity({
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
