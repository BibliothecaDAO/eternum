// @ts-nocheck - Allow this file to work in both Node.js deployment and browser admin UI contexts
import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  BuildingType,
  CapacityConfig,
  HexGrid,
  MERCENARIES_NAME_FELT,
  RESOURCE_PRECISION,
  ResourcesIds,
  scaleResourceInputs,
  scaleResourceOutputs,
  scaleResources,
  type Config as EternumConfig,
  type ResourceInputs,
  type ResourceOutputs,
  type ResourceWhitelistConfig,
} from "@bibliothecadao/types";

// Browser-compatible: Make chalk optional for browser environments
let chalk: any;
let pathModule: typeof import("path") | undefined;
try {
  // Support both ESM (chalk@5) and CJS resolution
  // If require returns a namespace with .default, unwrap it
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("chalk");
  chalk = (mod && typeof mod === "object" && "default" in mod ? mod.default : mod) as any;
} catch {
  // Fallback for browser/ESM environments where require is unavailable
  const noop = (str: string) => str;
  chalk = {
    cyan: noop,
    yellow: noop,
    white: noop,
    gray: noop,
    green: noop,
    red: noop,
    blue: noop,
  };
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pathModule = require("path");
} catch {
  pathModule = undefined;
}

import { getContractByName, NAMESPACE, type EternumProvider } from "@bibliothecadao/provider";
import { byteArray, type Account } from "starknet";
import type { NetworkType } from "utils/environment";
import type { Chain } from "utils/utils";
import { addCommas, hourMinutesSeconds, inGameAmount, shortHexAddress } from "../utils/formatting";

// Browser-compatible: Make fs optional for browser environments
let fs: any;
try {
  fs = require("fs");
} catch {
  // Fallback for browser - fs not available
  fs = null;
}

// Type compatibility for browser & Node environments
type AnyAccount = any; // Use any to avoid version conflicts between environments
type ConfigLogger = Pick<typeof globalThis.console, "log" | "info">;

let configLoggerStorage: {
  run: <Result>(logger: ConfigLogger, callback: () => Result) => Result;
  getStore: () => ConfigLogger | undefined;
} | null = null;
try {
  const { AsyncLocalStorage } = require("node:async_hooks");
  configLoggerStorage = new AsyncLocalStorage<ConfigLogger>();
} catch {
  // Browser fallback: legacy logging goes straight to the real console.
  configLoggerStorage = null;
}

const defaultLog = globalThis.console.log.bind(globalThis.console);
const defaultInfo = (globalThis.console.info ?? globalThis.console.log).bind(globalThis.console);
const console: ConfigLogger = {
  log: (...args: unknown[]) => {
    const scopedLogger = configLoggerStorage?.getStore();
    return (scopedLogger?.log ?? defaultLog)(...args);
  },
  info: (...args: unknown[]) => {
    const scopedLogger = configLoggerStorage?.getStore();
    return (scopedLogger?.info ?? scopedLogger?.log ?? defaultInfo)(...args);
  },
};

export function withConfigLogger<Result>(logger: ConfigLogger | undefined, operation: () => Result): Result {
  if (!configLoggerStorage || !logger) {
    return operation();
  }

  return configLoggerStorage.run(logger, operation);
}

interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumConfig;
}

export class GameConfigDeployer {
  public globalConfig: EternumConfig;
  public network: NetworkType;
  public skipSleeps: boolean = false;

  constructor(config: EternumConfig, network: NetworkType) {
    this.globalConfig = config;
    this.network = network;
  }

  async sleepNonLocal() {
    if (this.skipSleeps) return;
    if (this.network.toLowerCase() === "mainnet" || this.network.toLowerCase() === "sepolia") {
      let sleepSeconds = 1;
      console.log(chalk.gray(`Sleeping for ${sleepSeconds} seconds...`));
      await new Promise((resolve) => setTimeout(resolve, sleepSeconds * 1000));
    }
  }

  async setupAll(account: Account, provider: EternumProvider) {
    await this.setupNonBank(account, provider);
    // await this.setupBank(account, provider);
  }

  async setupNonBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await setWorldConfig(config);
    await this.sleepNonLocal();

    await setGameModeConfig(config);
    await this.sleepNonLocal();

    await setFactoryAddress(config);
    await this.sleepNonLocal();

    await setVictoryPointsConfig(config);
    await this.sleepNonLocal();

    await setDiscoverableVillageSpawnResourcesConfig(config);
    await this.sleepNonLocal();

    await setBlitzRegistrationConfig(config);
    await this.sleepNonLocal();

    await grantCollectibleLootChestMinterRole(config);
    await this.sleepNonLocal();

    await grantCollectibleEliteNftMinterRole(config);
    await this.sleepNonLocal();

    await setAgentConfig(config);
    await this.sleepNonLocal();

    await setVillageControllersConfig(config);
    await this.sleepNonLocal();

    await SetResourceFactoryConfig(config);
    await this.sleepNonLocal();

    await setResourceBridgeWtlConfig(config);
    await this.sleepNonLocal();

    await setTradeConfig(config);
    await this.sleepNonLocal();

    await setStartingResourcesConfig(config);
    await this.sleepNonLocal();

    await setSeasonConfig(config);
    await this.sleepNonLocal();

    await setVRFConfig(config);
    await this.sleepNonLocal();

    await setResourceBridgeFeesConfig(config);
    await this.sleepNonLocal();

    await setBuildingConfig(config);
    await this.sleepNonLocal();

    await setWeightConfig(config);
    await this.sleepNonLocal();

    await setBattleConfig(config);
    await this.sleepNonLocal();

    await setTroopConfig(config);
    await this.sleepNonLocal();

    await setRealmUpgradeConfig(config);
    await this.sleepNonLocal();

    await setStructureMaxLevelConfig(config);
    await this.sleepNonLocal();

    await setupGlobals(config);
    await this.sleepNonLocal();

    await setCapacityConfig(config);
    await this.sleepNonLocal();

    await setSpeedConfig(config);
    await this.sleepNonLocal();

    await setHyperstructureConfig(config);
    await this.sleepNonLocal();

    await setSettlementConfig(config);
    await this.sleepNonLocal();

    await setFaithConfig(config);
    await this.sleepNonLocal();

    await setArtificerConfig(config);
    await this.sleepNonLocal();
  }

  async setupBank(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await createBanks(config);
    await this.sleepNonLocal();

    // await mintResources(config);
    // await this.sleepNonLocal();

    await addLiquidity(config);
    await this.sleepNonLocal();
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

  const mercenariesName = MERCENARIES_NAME_FELT;
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

export const setResourceBridgeWtlConfig = async (config: Config) => {
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

  const {
    regularImmunityTicks: regular_immunity_ticks,
    villageImmunityTicks: village_immunity_ticks,
    villageRaidImmunityTicks: village_raid_immunity_ticks,
  } = config.config.battle;

  const calldata = {
    signer: config.account,
    regular_immunity_ticks,
    village_immunity_ticks,
    village_raid_immunity_ticks,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Battle Parameters")}
    │  ${chalk.gray(" Regular Immunity Period [For all structures fom game start]:")}      ${chalk.white(calldata.regular_immunity_ticks + " ticks")}
    │  ${chalk.gray(" Village Immunity Period [For villages from time of settlement]:")}      ${chalk.white(calldata.village_immunity_ticks + " ticks")}
    │  ${chalk.gray(" Village Raid Immunity:")} ${chalk.white(calldata.village_raid_immunity_ticks + " ticks")}
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
      staminaDefenseReq: stamina_defense_req,
      staminaExploreWheatCost: stamina_explore_wheat_cost,
      staminaExploreFishCost: stamina_explore_fish_cost,
      staminaExploreStaminaCost: stamina_explore_stamina_cost,
      staminaTravelWheatCost: stamina_travel_wheat_cost,
      staminaTravelFishCost: stamina_travel_fish_cost,
      staminaTravelStaminaCost: stamina_travel_stamina_cost,
    },
    limit: {
      guardResurrectionDelay: guard_resurrection_delay,
      mercenariesTroopLowerBound: mercenaries_troop_lower_bound,
      mercenariesTroopUpperBound: mercenaries_troop_upper_bound,
      agentTroopLowerBound: agent_troop_lower_bound,
      agentTroopUpperBound: agent_troop_upper_bound,
      settlementDeploymentCap: settlement_deployment_cap,
      cityDeploymentCap: city_deployment_cap,
      kingdomDeploymentCap: kingdom_deployment_cap,
      empireDeploymentCap: empire_deployment_cap,
      t1TierStrength: t1_tier_strength,
      t2TierStrength: t2_tier_strength,
      t3TierStrength: t3_tier_strength,
      t1TierModifier: t1_tier_modifier,
      t2TierModifier: t2_tier_modifier,
      t3TierModifier: t3_tier_modifier,
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
      stamina_defense_req: stamina_defense_req,
      stamina_explore_wheat_cost: stamina_explore_wheat_cost * config.config.resources.resourcePrecision,
      stamina_explore_fish_cost: stamina_explore_fish_cost * config.config.resources.resourcePrecision,
      stamina_explore_stamina_cost: stamina_explore_stamina_cost,
      stamina_travel_wheat_cost: stamina_travel_wheat_cost * config.config.resources.resourcePrecision,
      stamina_travel_fish_cost: stamina_travel_fish_cost * config.config.resources.resourcePrecision,
      stamina_travel_stamina_cost: stamina_travel_stamina_cost,
    },
    limit_config: {
      guard_resurrection_delay: guard_resurrection_delay,
      mercenaries_troop_lower_bound: mercenaries_troop_lower_bound,
      mercenaries_troop_upper_bound: mercenaries_troop_upper_bound,
      agent_troop_lower_bound: agent_troop_lower_bound,
      agent_troop_upper_bound: agent_troop_upper_bound,
      settlement_deployment_cap: settlement_deployment_cap,
      city_deployment_cap: city_deployment_cap,
      kingdom_deployment_cap: kingdom_deployment_cap,
      empire_deployment_cap: empire_deployment_cap,
      t1_tier_strength: t1_tier_strength,
      t2_tier_strength: t2_tier_strength,
      t3_tier_strength: t3_tier_strength,
      t1_tier_modifier: t1_tier_modifier,
      t2_tier_modifier: t2_tier_modifier,
      t3_tier_modifier: t3_tier_modifier,
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
    │  ${chalk.gray("Defense Requirement:")}              ${chalk.white(calldata.stamina_config.stamina_defense_req)}
    │  ${chalk.gray("Explore Wheat Cost:")}     ${chalk.white(calldata.stamina_config.stamina_explore_wheat_cost / config.config.resources.resourcePrecision)}
    │  ${chalk.gray("Explore Fish Cost:")}        ${chalk.white(calldata.stamina_config.stamina_explore_fish_cost / config.config.resources.resourcePrecision)}
    │  ${chalk.gray("Explore Stamina Cost:")}    ${chalk.white(calldata.stamina_config.stamina_explore_stamina_cost)}
    │  ${chalk.gray("Travel Wheat Cost:")}       ${chalk.white(calldata.stamina_config.stamina_travel_wheat_cost / config.config.resources.resourcePrecision)}
    │  ${chalk.gray("Travel Fish Cost:")}        ${chalk.white(calldata.stamina_config.stamina_travel_fish_cost / config.config.resources.resourcePrecision)}
    │  ${chalk.gray("Travel Stamina Cost:")}     ${chalk.white(calldata.stamina_config.stamina_travel_stamina_cost)}
    │
    │  ${chalk.yellow("Limit Configuration")}
    │  ${chalk.gray("Guard Resurrection:")}       ${chalk.white(calldata.limit_config.guard_resurrection_delay)}
    │  ${chalk.gray("Mercenary Min:")}           ${chalk.white(calldata.limit_config.mercenaries_troop_lower_bound)}
    │  ${chalk.gray("Mercenary Max:")}           ${chalk.white(calldata.limit_config.mercenaries_troop_upper_bound)}
    │  ${chalk.gray("Agent Min:")}               ${chalk.white(calldata.limit_config.agent_troop_lower_bound)}
    │  ${chalk.gray("Agent Max:")}               ${chalk.white(calldata.limit_config.agent_troop_upper_bound)}
    │  ${chalk.gray("Settlement Cap:")}          ${chalk.white(calldata.limit_config.settlement_deployment_cap)}
    │  ${chalk.gray("City Cap:")}                ${chalk.white(calldata.limit_config.city_deployment_cap)}
    │  ${chalk.gray("Kingdom Cap:")}             ${chalk.white(calldata.limit_config.kingdom_deployment_cap)}
    │  ${chalk.gray("Empire Cap:")}              ${chalk.white(calldata.limit_config.empire_deployment_cap)}
    │  ${chalk.gray("T1 Tier Strength:")}       ${chalk.white(calldata.limit_config.t1_tier_strength)}
    │  ${chalk.gray("T2 Tier Strength:")}       ${chalk.white(calldata.limit_config.t2_tier_strength)}
    │  ${chalk.gray("T3 Tier Strength:")}       ${chalk.white(calldata.limit_config.t3_tier_strength)}
    │  ${chalk.gray("T1 Tier Modifier:")}       ${chalk.white(calldata.limit_config.t1_tier_modifier)}
    │  ${chalk.gray("T2 Tier Modifier:")}       ${chalk.white(calldata.limit_config.t2_tier_modifier)}
    │  ${chalk.gray("T3 Tier Modifier:")}       ${chalk.white(calldata.limit_config.t3_tier_modifier)}
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

  const tickConfigCalldata = {
    signer: config.account,
    tick_interval_in_seconds: config.config.tick.armiesTickIntervalInSeconds,
    delivery_tick_interval_in_seconds: config.config.tick.deliveryTickIntervalInSeconds,
    bitcoin_phase_in_seconds: config.config.tick.bitcoinPhaseInSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Tick Intervals")}
    │  ${chalk.gray("World Tick:")}            ${chalk.white(hourMinutesSeconds(tickConfigCalldata.tick_interval_in_seconds))}
    │  ${chalk.gray("Delivery Tick:")}            ${chalk.white(hourMinutesSeconds(tickConfigCalldata.delivery_tick_interval_in_seconds))}
    │  ${chalk.gray("Bitcoin Phase:")}            ${chalk.white(hourMinutesSeconds(tickConfigCalldata.bitcoin_phase_in_seconds))}
    └────────────────────────────────`),
  );

  const txTick = await config.provider.set_tick_config(tickConfigCalldata);
  console.log(chalk.green(`    ✔ Tick configured `) + chalk.gray(txTick.statusReceipt));

  // Map Config
  const mapCalldata = {
    signer: config.account,
    reward_amount: config.config.exploration.reward,
    shards_mines_win_probability: config.config.exploration.shardsMinesWinProbability,
    shards_mines_fail_probability: config.config.exploration.shardsMinesFailProbability,
    agent_find_probability: config.config.exploration.agentFindProbability,
    agent_find_fail_probability: config.config.exploration.agentFindFailProbability,
    camp_find_probability: config.config.exploration.campFindProbability,
    camp_find_fail_probability: config.config.exploration.campFindFailProbability,
    holysite_find_probability: config.config.exploration.holysiteFindProbability,
    bitcoin_mine_win_probability: config.config.exploration.bitcoinMineWinProbability,
    bitcoin_mine_fail_probability: config.config.exploration.bitcoinMineFailProbability,
    holysite_find_fail_probability: config.config.exploration.holysiteFindFailProbability,
    hyps_win_prob: config.config.exploration.hyperstructureWinProbAtCenter,
    hyps_fail_prob: config.config.exploration.hyperstructureFailProbAtCenter,
    hyps_fail_prob_increase_p_hex: config.config.exploration.hyperstructureFailProbIncreasePerHexDistance,
    hyps_fail_prob_increase_p_fnd: config.config.exploration.hyperstructureFailProbIncreasePerHyperstructureFound,
    relic_discovery_interval_sec: config.config.exploration.relicDiscoveryIntervalSeconds,
    relic_hex_dist_from_center: config.config.exploration.relicHexDistanceFromCenter,
    relic_chest_relics_per_chest: config.config.exploration.relicChestRelicsPerChest,
  };

  const shardsMinesFailRate =
    (mapCalldata.shards_mines_fail_probability /
      (mapCalldata.shards_mines_fail_probability + mapCalldata.shards_mines_win_probability)) *
    100;
  const campFindFailRate =
    (mapCalldata.camp_find_fail_probability /
      (mapCalldata.camp_find_fail_probability + mapCalldata.camp_find_probability)) *
    100;
  const holysiteFindFailRate =
    (mapCalldata.holysite_find_fail_probability /
      (mapCalldata.holysite_find_fail_probability + mapCalldata.holysite_find_probability)) *
    100;
  const bitcoinMineFindFailRate =
    (mapCalldata.bitcoin_mine_fail_probability /
      (mapCalldata.bitcoin_mine_fail_probability + mapCalldata.bitcoin_mine_win_probability)) *
    100;
  const agentFindFailRate =
    (mapCalldata.agent_find_fail_probability /
      (mapCalldata.agent_find_fail_probability + mapCalldata.agent_find_probability)) *
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
    │  ${chalk.gray("Camp Find Fail Probability:")} ${chalk.white(campFindFailRate) + "%"}
    │  ${chalk.gray("Holy Site Find Fail Probability:")} ${chalk.white(holysiteFindFailRate) + "%"}
    │  ${chalk.gray("Bitcoin Mine Find Fail Probability:")} ${chalk.white(bitcoinMineFindFailRate) + "%"}
    │  ${chalk.gray("Agent Find Fail Probability:")} ${chalk.white(agentFindFailRate) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability At The Center:")} ${chalk.white(hyperstructureFailRateAtTheCenter) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability Increase Per Hex:")} ${chalk.white(hyperstructureFailRateIncreasePerHex) + "%"}
    │  ${chalk.gray("Hyperstructure Fail Probability Increase Per Hyperstructure Found:")} ${chalk.white(hyperstructureFailRateIncreasePerHyperstructureFound) + "%"}
    │  ${chalk.gray("Shards Mines Reward Fail Rate:")}     ${chalk.white(((mapCalldata.shards_mines_fail_probability / (mapCalldata.shards_mines_fail_probability + mapCalldata.shards_mines_win_probability)) * 100).toFixed(2) + "%")}
    │  ${chalk.gray("Relic Discovery Interval:")} ${chalk.white(mapCalldata.relic_discovery_interval_sec + " seconds")}
    │  ${chalk.gray("Relic Hex Distance from Center:")} ${chalk.white(mapCalldata.relic_hex_dist_from_center)}
    │  ${chalk.gray("Relic Chest Relics per Chest:")} ${chalk.white(mapCalldata.relic_chest_relics_per_chest)}
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
    holysite_capacity: config.config.carryCapacityGram[CapacityConfig.HolySiteStructure],
    camp_capacity: config.config.carryCapacityGram[CapacityConfig.CampStructure],
    bitcoin_mine_capacity: config.config.carryCapacityGram[CapacityConfig.BitcoinMineStructure],
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
    { name: "Holy Site", value: calldata.holysite_capacity },
    { name: "Camp", value: calldata.camp_capacity },
    { name: "Bitcoin Mine", value: calldata.bitcoin_mine_capacity },
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
  if (config.config.blitz.mode.on) {
    console.log(chalk.yellow("Blitz mode is on, skipping season configuration \n"));
    return;
  }

  console.log(
    chalk.cyan(`
  🎮 Season Configuration
  ═══════════════════════`),
  );

  const now = Math.floor(new Date().getTime() / 1000);
  let startMainAt = 0;
  let startSettlingAt = 0;

  if (config.config.season.startMainAt && config.config.season.startMainAt > 0) {
    startMainAt = config.config.season.startMainAt;
  } else {
    startMainAt = now + config.config.season.startMainAfterSeconds;
  }

  if (config.config.season.startSettlingAt && config.config.season.startSettlingAt > 0) {
    startSettlingAt = config.config.season.startSettlingAt;
  } else {
    startSettlingAt = now + config.config.season.startSettlingAfterSeconds;
  }

  const seasonCalldata = {
    signer: config.account,
    dev_mode_on: config.config.dev.mode.on,
    season_pass_address: config.config.setup!.addresses.seasonPass,
    realms_address: config.config.setup!.addresses.realms,
    lords_address: config.config.setup!.addresses.lords,
    start_settling_at: startSettlingAt,
    start_main_at: startMainAt,
    end_at: 0,
    bridge_close_end_grace_seconds: config.config.season.bridgeCloseAfterEndSeconds,
    point_registration_grace_seconds: config.config.season.pointRegistrationCloseAfterEndSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Season Parameters")}
    │  ${chalk.gray("Dev Mode On:")}   ${chalk.white(config.config.dev.mode.on)}
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
    │  ${chalk.gray("Bridge Closes:")}   ${chalk.white(hourMinutesSeconds(seasonCalldata.bridge_close_end_grace_seconds))} after game ends
    │  ${chalk.gray("Point Registration Closes:")}   ${chalk.white(hourMinutesSeconds(seasonCalldata.point_registration_grace_seconds))} after game ends
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
  if (
    config.config.setup?.chain !== "mainnet" &&
    config.config.setup?.chain !== "sepolia" &&
    config.config.setup?.chain !== "slot"
  ) {
    console.log(chalk.yellow("    ⚠ Skipping VRF configuration for local environment"));
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

  const { hyperstructureConstructionCost, hyperstructureInitializationShardsCost } = config.config.hyperstructures;

  const initializationShardsAmount = hyperstructureInitializationShardsCost.amount;
  const hyperstructureCalldata = {
    signer: config.account,
    initialize_shards_amount: initializationShardsAmount * config.config.resources.resourcePrecision,
    construction_resources: hyperstructureConstructionCost,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Hyperstructure Points System")}
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

  const {
    center,
    base_distance,
    layers_skipped,
    layer_max,
    layer_capacity_increment,
    layer_capacity_bps,
    spires_layer_distance,
    spires_max_count,
    spires_settled_count,
    single_realm_mode,
    two_player_mode = false,
  } = config.config.settlement;

  const calldata = {
    signer: config.account,
    center,
    base_distance,
    layers_skipped,
    layer_max,
    layer_capacity_increment,
    layer_capacity_bps,
    spires_layer_distance,
    spires_max_count,
    spires_settled_count,
    single_realm_mode,
    two_player_mode,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Layout Parameters")}
    │  ${chalk.gray("Center:")}                    ${chalk.white(`(${calldata.center}, ${calldata.center})`)}
    │  ${chalk.gray("Base Distance:")}             ${chalk.white(calldata.base_distance)}
    │  ${chalk.gray("Layers Skipped:")}            ${chalk.white(calldata.layers_skipped)}
    │  ${chalk.gray("Layer Max:")}                 ${chalk.white(calldata.layer_max)}
    │  ${chalk.gray("Layer Capacity Increment:")} ${chalk.white(calldata.layer_capacity_increment)}
    │  ${chalk.gray("Layer Capacity BPS:")}        ${chalk.white(calldata.layer_capacity_bps)} ${chalk.gray("(= " + calldata.layer_capacity_bps / 100 + "%)")}
    │  ${chalk.gray("Spires Layer Distance:")}     ${chalk.white(calldata.spires_layer_distance)}
    │  ${chalk.gray("Spires Max Count:")}          ${chalk.white(calldata.spires_max_count)}
    │  ${chalk.gray("Spires Settled Count:")}      ${chalk.white(calldata.spires_settled_count)}
    │  ${chalk.gray("Single Realm Mode:")}         ${chalk.white(calldata.single_realm_mode)}
    │  ${chalk.gray("Two Player Mode:")}          ${chalk.white(calldata.two_player_mode)}
    │
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_settlement_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setFaithConfig = async (config: Config) => {
  if (!config.config.faith) {
    console.log(chalk.yellow(`\n  ⛪ Faith Configuration: Skipped (no config)\n`));
    return;
  }

  console.log(
    chalk.cyan(`
  ⛪ Faith Configuration
  ═══════════════════════════`),
  );

  const {
    enabled,
    wonder_base_fp_per_sec,
    holy_site_fp_per_sec,
    realm_fp_per_sec,
    village_fp_per_sec,
    owner_share_percent,
    reward_token,
  } = config.config.faith;

  const calldata = {
    signer: config.account,
    enabled,
    wonder_base_fp_per_sec,
    holy_site_fp_per_sec,
    realm_fp_per_sec,
    village_fp_per_sec,
    owner_share_percent: owner_share_percent * 100, // Convert percentage to basis points
    reward_token,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Faith Parameters")}
    │  ${chalk.gray("Enabled:")}                 ${chalk.white(calldata.enabled)}
    │  ${chalk.gray("Wonder FP/sec:")}           ${chalk.white(calldata.wonder_base_fp_per_sec)}
    │  ${chalk.gray("Holy Site FP/sec:")}        ${chalk.white(calldata.holy_site_fp_per_sec)}
    │  ${chalk.gray("Realm FP/sec:")}            ${chalk.white(calldata.realm_fp_per_sec)}
    │  ${chalk.gray("Village FP/sec:")}          ${chalk.white(calldata.village_fp_per_sec)}
    │  ${chalk.gray("Owner Share:")}             ${chalk.white(owner_share_percent + "%")}
    │  ${chalk.gray("Reward Token:")}            ${chalk.white(calldata.reward_token)}
    │
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_faith_config(calldata);

  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setArtificerConfig = async (config: Config) => {
  if (!config.config.artificer) {
    console.log(chalk.yellow(`\n  🔬 Artificer Configuration: Skipped (no config)\n`));
    return;
  }

  console.log(
    chalk.cyan(`
  🔬 Artificer Configuration
  ═══════════════════════════`),
  );

  const { research_cost_for_relic } = config.config.artificer;

  // Apply resource precision to the cost (config stores human-readable value)
  const calldata = {
    signer: config.account,
    research_cost_for_relic: research_cost_for_relic * config.config.resources.resourcePrecision,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Artificer Config")}
    │  ${chalk.gray("Research Cost for Relic:")} ${chalk.white(research_cost_for_relic)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_artificer_config(calldata);
  console.log(chalk.green(`\n    ✔ Artificer configured `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setGameModeConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏘️  Game Mode Configuration
  ═══════════════════════════`),
  );

  const gameModeTx = await config.provider.set_game_mode_config({
    signer: config.account,
    blitz_mode_on: config.config.blitz.mode.on,
  });
  console.log(
    chalk.green(`\n    ✔ Game mode configured to ${config.config.blitz.mode.on} `) +
      chalk.gray(gameModeTx.statusReceipt) +
      "\n",
  );
};

export const setFactoryAddress = async (config: Config) => {
  // Read previously saved address from configuration
  const factoryAddress = (config.config as any)?.factory_address as string | undefined;
  if (!factoryAddress) {
    console.log(chalk.gray("    ↪ No factory_address found in config; skipping factory address setup"));
    return;
  }

  console.log(
    chalk.cyan(`
  ⚡ Factory Address
  ═════════════════════`),
  );
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Factory Address")}
    │  ${chalk.gray("Address:")} ${chalk.white(factoryAddress)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_factory_address({
    signer: config.account,
    factory_address: factoryAddress!,
  });
  console.log(chalk.green(`\n    ✔ Blitz factory address set `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setMMRConfig = async (config: Config) => {
  // Read MMR config from configuration
  // Note: initial_mmr and min_mmr are handled by the token contract, not the game contract
  const mmrConfig = (config.config as any)?.mmr as
    | {
        enabled: boolean;
        mmr_token_address: string;
        distribution_mean?: number;
        spread_factor?: number;
        max_delta?: number;
        k_factor?: number;
        lobby_split_weight_scaled?: number;
        mean_regression_scaled?: number;
        min_players?: number;
      }
    | undefined;
  if (!mmrConfig) {
    console.log(chalk.gray("    ↪ No mmr config found; skipping MMR configuration"));
    return;
  }

  console.log(
    chalk.cyan(`
  🎯 MMR Configuration
  ═════════════════════`),
  );

  // Use defaults from the spec if not provided
  const enabled = mmrConfig.enabled ?? false;
  const mmr_token_address = mmrConfig.mmr_token_address ?? "0x0";
  const distribution_mean = mmrConfig.distribution_mean ?? 1500;
  const spread_factor = mmrConfig.spread_factor ?? 450;
  const max_delta = mmrConfig.max_delta ?? 45;
  const k_factor = mmrConfig.k_factor ?? 50;
  const lobby_split_weight_scaled = mmrConfig.lobby_split_weight_scaled ?? 2500;
  const mean_regression_scaled = mmrConfig.mean_regression_scaled ?? 150;
  const min_players = mmrConfig.min_players ?? 6;

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("MMR Parameters")}
    │  ${chalk.gray("Enabled:")} ${chalk.white(enabled)}
    │  ${chalk.gray("Token Address:")} ${chalk.white(shortHexAddress(mmr_token_address))}
    │  ${chalk.gray("Distribution Mean:")} ${chalk.white(distribution_mean)}
    │  ${chalk.gray("Spread Factor:")} ${chalk.white(spread_factor)}
    │  ${chalk.gray("Max Delta:")} ${chalk.white(max_delta)}
    │  ${chalk.gray("K Factor:")} ${chalk.white(k_factor)}
    │  ${chalk.gray("Lobby Split Weight:")} ${chalk.white(lobby_split_weight_scaled / 10000)}
    │  ${chalk.gray("Mean Regression:")} ${chalk.white(mean_regression_scaled / 10000)}
    │  ${chalk.gray("Min Players:")} ${chalk.white(min_players)}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_mmr_config({
    signer: config.account,
    enabled,
    mmr_token_address,
    distribution_mean,
    spread_factor,
    max_delta,
    k_factor,
    lobby_split_weight_scaled,
    mean_regression_scaled,
    min_players,
  });
  console.log(chalk.green(`\n    ✔ MMR configured `) + chalk.gray(tx.statusReceipt) + "\n");
};

export const setVictoryPointsConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏆  Victory Points Configuration
  ═══════════════════════════`),
  );

  const victoryPointsTx = await config.provider.set_victory_points_config({
    signer: config.account,
    points_for_win: config.config.victoryPoints.pointsForWin,
    hyperstructure_points_per_second: config.config.victoryPoints.hyperstructurePointsPerCycle,
    points_for_hyperstructure_claim_against_bandits:
      config.config.victoryPoints.pointsForHyperstructureClaimAgainstBandits,
    points_for_non_hyperstructure_claim_against_bandits:
      config.config.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits,
    points_for_tile_exploration: config.config.victoryPoints.pointsForTileExploration,
    points_for_relic_open: config.config.victoryPoints.pointsForRelicDiscovery,
  });
  console.log(chalk.green(`\n    ✔ Victory points configured `) + chalk.gray(victoryPointsTx.statusReceipt) + "\n");
};

export const setDiscoverableVillageSpawnResourcesConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏘️  Discoverable Village Spawn Resources Configuration
  ═══════════════════════════`),
  );

  // log the resources
  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Discoverable Village Spawn Resources")}
    │  ${chalk.gray("Resources:")} ${chalk.white(config.config.discoverableVillageStartingResources.map((resource) => `${resource.resource}: ${resource.min_amount} - ${resource.max_amount}`).join(", "))}
    └────────────────────────────────`),
  );

  const discoverableVillageSpawnResourcesTx = await config.provider.set_discoverable_village_starting_resources_config({
    signer: config.account,
    resources: config.config.discoverableVillageStartingResources.map((resource) => ({
      resource: resource.resource,
      min_amount: resource.min_amount * RESOURCE_PRECISION,
      max_amount: resource.max_amount * RESOURCE_PRECISION,
    })),
  });
  console.log(
    chalk.green(`\n    ✔ Discoverable village spawn resources configured `) +
      chalk.gray(discoverableVillageSpawnResourcesTx.statusReceipt) +
      "\n",
  );
};

export const setBlitzRegistrationConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🏘️  Blitz Registration Configuration
  ═══════════════════════════`),
  );
  if (!config.config.blitz.mode.on) {
    console.log(chalk.yellow("Blitz mode is off, skipping blitz registration configuration \n"));
    return;
  }

  let registration_delay_seconds = config.config.blitz.registration.registration_delay_seconds;
  let registration_period_seconds = config.config.blitz.registration.registration_period_seconds;

  let registration_start_at = Math.floor(new Date().getTime() / 1000) + registration_delay_seconds;
  let registration_end_at = registration_start_at + registration_period_seconds;

  let startMainAt = config.config.season.startMainAt;
  if (startMainAt && startMainAt > 0) {
    registration_end_at = startMainAt - 1;
    registration_start_at = registration_end_at - registration_period_seconds;
  }

  const entryTokenClassHash = config.config.blitz.registration.entry_token_class_hash;
  const entryTokenIpfsCid = byteArray.byteArrayFromString(config.config.blitz.registration.entry_token_ipfs_cid);
  const entryTokenDeployCalldata = [
    "0x0",
    "0x5265616c6d733a204c6f6f74204368657374",
    "0x12",
    "0x0",
    "0x524c43",
    "0x3",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x4c6f6f7420436865737420666f72205265616c6d73",
    "0x15",
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    getContractByName(config.provider.manifest, `${NAMESPACE}-blitz_realm_systems`),
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    getContractByName(config.provider.manifest, `${NAMESPACE}-config_systems`),
    getContractByName(config.provider.manifest, `${NAMESPACE}-config_systems`),
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    "0x1f4",
  ];

  const collectibles_cosmetics_max = config.config.blitz.registration.collectible_cosmetics_max_items;
  const collectibles_cosmetics_address = config.config.blitz.registration.collectible_cosmetics_address;
  const collectibles_timelock_address = config.config.blitz.registration.collectible_timelock_address;
  const collectibles_lootchest_address = config.config.blitz.registration.collectibles_lootchest_address;
  const collectibles_elitenft_address = config.config.blitz.registration.collectibles_elitenft_address;

  const registrationCalldata = {
    signer: config.account,
    fee_token: config.config.blitz.registration.fee_token,
    fee_recipient: config.config.blitz.registration.fee_recipient,
    fee_amount: config.config.blitz.registration.fee_amount,
    registration_count_max: config.config.blitz.registration.registration_count_max,
    registration_start_at: registration_start_at,
    entry_token_class_hash: entryTokenClassHash,
    entry_token_ipfs_cid: entryTokenIpfsCid,
    entry_token_deploy_calldata: entryTokenDeployCalldata,

    collectibles_cosmetics_max,
    collectibles_cosmetics_address,
    collectibles_timelock_address,
    collectibles_lootchest_address,
    collectibles_elitenft_address,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Blitz Registration Configuration")}
    │  ${chalk.gray("Fee Token:")} ${chalk.white(registrationCalldata.fee_token)}
    │  ${chalk.gray("Fee Recipient:")} ${chalk.white(registrationCalldata.fee_recipient)}
    │  ${chalk.gray("Fee Amount:")} ${chalk.white(registrationCalldata.fee_amount)}
    │  ${chalk.gray("Registration Count Max:")} ${chalk.white(registrationCalldata.registration_count_max)}
    │  ${chalk.gray("Registration Start At:")} ${chalk.white(
      new Date(registrationCalldata.registration_start_at * 1000).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    )} UTC
    │  ${chalk.gray("Entry Token IPFS CID:")} ${chalk.white(byteArray.stringFromByteArray(registrationCalldata.entry_token_ipfs_cid))}
    │  ${chalk.gray("Entry Token Class Hash:")} ${chalk.white(registrationCalldata.entry_token_class_hash)}
    │  ${chalk.gray("Entry Token Deploy Calldata:")} ${chalk.white(
      `[${registrationCalldata.entry_token_deploy_calldata.slice(0, 3).join(", ")}, ..., ${registrationCalldata.entry_token_deploy_calldata.slice(-3).join(", ")}]`,
    )}
    │  ${chalk.gray("Collectible Cosmetics Max Items:")} ${chalk.white(registrationCalldata.collectibles_cosmetics_max)}
    │  ${chalk.gray("Collectible Cosmetics Address:")} ${chalk.white(shortHexAddress(registrationCalldata.collectibles_cosmetics_address))}
    │  ${chalk.gray("Collectible Timelock Address:")} ${chalk.white(shortHexAddress(registrationCalldata.collectibles_timelock_address))}
    │  ${chalk.gray("Collectible LootChest Address:")} ${chalk.white(shortHexAddress(registrationCalldata.collectibles_lootchest_address))}
    │  ${chalk.gray("Collectible EliteNFT Address:")} ${chalk.white(shortHexAddress(registrationCalldata.collectibles_elitenft_address))}
    │
    └────────────────────────────────`),
  );

  // Grant MINTER_ROLE to prize_distribution_systems for loot chest minting
  const blitzRegistrationTx = await config.provider.set_blitz_registration_config(registrationCalldata);
  console.log(
    chalk.green(`\n    ✔ Blitz registration configured `) + chalk.gray(blitzRegistrationTx.statusReceipt) + "\n",
  );

  console.log(
    chalk.cyan(`\n\n
  🎮 Blitz Season Configuration
  ═══════════════════════`),
  );

  const seasonCalldata = {
    signer: config.account,
    dev_mode_on: config.config.dev.mode.on,
    season_pass_address: "0x0",
    realms_address: "0x0",
    lords_address: config.config.setup!.addresses.lords,
    start_settling_at: registration_start_at,
    start_main_at: registration_end_at,
    end_at: registration_end_at + config.config.season.durationSeconds,
    bridge_close_end_grace_seconds: 0,
    point_registration_grace_seconds: config.config.season.pointRegistrationCloseAfterEndSeconds,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Season Parameters")}
    │  ${chalk.gray("Dev Mode On:")}   ${chalk.white(config.config.dev.mode.on)}
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
    │  ${chalk.gray("Bridge Closes:")}   ${chalk.white(hourMinutesSeconds(seasonCalldata.bridge_close_end_grace_seconds))} after game ends
    │  ${chalk.gray("Point Registration Closes:")}   ${chalk.white(hourMinutesSeconds(seasonCalldata.point_registration_grace_seconds))} after game ends
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

export const grantCollectibleLootChestMinterRole = async (config: Config) => {
  if (!config.config.blitz?.mode?.on) {
    console.log(chalk.yellow("⏭️  Skipping minter role grant (Blitz mode is off)"));
    return;
  }

  if (!config.config.blitz?.registration?.collectibles_lootchest_address) {
    console.log(chalk.yellow("⏭️  Skipping minter role grant (No loot chest address configured)"));
    return;
  }

  console.log(
    chalk.cyan(`\n
  🎫 Grant Collectible Minter Role For Loot Chest
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Granting Minter Role")}
    │  ${chalk.gray("Granting minter role for Loot Chest Contract to prize_distribution_systems...")}
    └────────────────────────────────`),
  );

  const collectibles_lootchest_address = config.config.blitz.registration.collectibles_lootchest_address;
  const prizeDistributionSystemsAddr = getContractByName(
    config.provider.manifest,
    `${NAMESPACE}-prize_distribution_systems`,
  );

  const grantRoleTx = await config.provider.grant_collectible_minter_role({
    signer: config.account,
    collectible_address: collectibles_lootchest_address,
    minter_address: prizeDistributionSystemsAddr,
  });

  console.log(chalk.green(`    ✔ Minter role granted `) + chalk.gray(grantRoleTx.statusReceipt) + "\n");
};

export const grantCollectibleEliteNftMinterRole = async (config: Config) => {
  if (!config.config.blitz?.mode?.on) {
    console.log(chalk.yellow("⏭️  Skipping minter role grant (Blitz mode is off)"));
    return;
  }

  if (!config.config.blitz?.registration?.collectibles_elitenft_address) {
    console.log(chalk.yellow("⏭️  Skipping minter role grant (No elite NFT address configured)"));
    return;
  }

  console.log(
    chalk.cyan(`\n
  🎫 Grant Collectible Minter Role For Elite NFT
  ═══════════════════════════════`),
  );

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Granting Minter Role")}
    │  ${chalk.gray("Granting minter role for Elite NFT Contract to prize_distribution_systems...")}
    └────────────────────────────────`),
  );

  const collectibles_elitenft_address = config.config.blitz.registration.collectibles_elitenft_address;
  const prizeDistributionSystemsAddr = getContractByName(
    config.provider.manifest,
    `${NAMESPACE}-prize_distribution_systems`,
  );

  const grantRoleTx = await config.provider.grant_collectible_minter_role({
    signer: config.account,
    collectible_address: collectibles_elitenft_address,
    minter_address: prizeDistributionSystemsAddr,
  });

  console.log(chalk.green(`    ✔ Minter role granted for Elite NFT `) + chalk.gray(grantRoleTx.statusReceipt) + "\n");
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
  const stepsFromCenter = 15 * 21;
  const distantCoordinates = HexGrid.findHexCoordsfromCenter(stepsFromCenter);
  for (const [_, coord] of Object.entries(distantCoordinates)) {
    bank_coords.push({ alt: false, x: coord.x, y: coord.y });
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

export const nodeReadConfig = async (chain: Chain, gameType: string) => {
  if (!fs) {
    throw new Error("nodeReadConfig is only available in Node.js environment");
  }

  try {
    const configPath = pathModule
      ? pathModule.resolve(import.meta.dir, `../generated/${gameType}.${chain}.json`)
      : `./generated/${gameType}.${chain}.json`;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.configuration as any; // as any to avoid type errors
  } catch (error) {
    throw new Error(`Failed to load configuration for ${gameType} on chain ${chain}: ${error}`);
  }
};
