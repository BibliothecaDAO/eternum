import devManifest from "../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../contracts/manifests/prod/deployment/manifest.json";

import { CapacityConfigCategory, EternumConfig, EternumProvider, ResourcesIds } from "@bibliothecadao/eternum";
import { Account } from "starknet";

if (
  !process.env.VITE_PUBLIC_MASTER_ADDRESS ||
  !process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY ||
  !process.env.VITE_PUBLIC_NODE_URL
) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}

const VITE_PUBLIC_MASTER_ADDRESS = process.env.VITE_PUBLIC_MASTER_ADDRESS;
const VITE_PUBLIC_MASTER_PRIVATE_KEY = process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;

const manifest = process.env.VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;

// Bug in bun we have to use http://127.0.0.1:5050/
const nodeUrl = process.env.VITE_PUBLIC_DEV === "true" ? "http://127.0.0.1:5050/" : process.env.VITE_PUBLIC_NODE_URL;

const isDev = process.env.VITE_PUBLIC_DEV === "true";

if (!isDev) {
  const userConfirmation = prompt(
    "You are about to set the configuration for a non-development environment. Are you sure you want to proceed? (yes/no)",
  );
  if (userConfirmation?.toLowerCase() !== "yes") {
    console.log("Configuration setup cancelled.");
    process.exit(0);
  }
}

console.log("Setting up config...");
const provider = new EternumProvider(manifest, nodeUrl);
console.log("Provider set up");
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);
console.log("Account set up");

export const EternumGlobalConfig = {
  stamina: {
    travelCost: 10,
    exploreCost: 20,
  },
  resources: {
    resourcePrecision: 1000,
    resourceMultiplier: 1000,
    resourceAmountPerTick: 10,
    startingResourcesInputProductionFactor: 4,
  },
  banks: {
    lordsCost: 1000,
    lpFeesNumerator: 15,
    lpFeesDenominator: 100, // %
    ownerFeesNumerator: 15,
    ownerFeesDenominator: 100, // %
  },
  populationCapacity: {
    workerHuts: 5,
  },
  exploration: {
    // food burn amount per unit during exploration
    exploreWheatBurn: 0.003,
    exploreFishBurn: 0.003,
    // food burn amount per unit during travel
    travelWheatBurn: 0.001,
    travelFishBurn: 0.001,
    reward: 750,
    shardsMinesFailProbability: 99000,
  },
  tick: {
    defaultTickIntervalInSeconds: 1,
    armiesTickIntervalInSeconds: 3600, // 1 hour
  },
  carryCapacityGram: {
    [CapacityConfigCategory.None]: 0,
    [CapacityConfigCategory.Structure]: BigInt(2) ** BigInt(128) - BigInt(1),
    [CapacityConfigCategory.Donkey]: 100_000,
    [CapacityConfigCategory.Army]: 10_000,
    [CapacityConfigCategory.Storehouse]: 10_000_000_000,
  },
  speed: {
    donkey: 6,
    army: 1,
  },
  battle: {
    graceTickCount: 24,
    delaySeconds: 8 * 60 * 60,
  },
  troop: {
    // The 7,200 health value makes battles last up to 20hours at a maximum.
    // This max will be reached if both armies are very similar in strength and health
    // To reduce max battle time by 4x for example, change the health to (7,200 / 4)
    // which will make the max battle time = 5 hours.
    health: 7_200,
    knightStrength: 1,
    paladinStrength: 1,
    crossbowmanStrength: 1,
    advantagePercent: 1000,
    disadvantagePercent: 1000,
    maxTroopCount: 500_000,
    baseArmyNumberForStructure: 3,
    armyExtraPerMilitaryBuilding: 1,
    // max attacking armies per structure = 6 + 1 defensive army
    maxArmiesPerStructure: 7, // 3 + (3 * 1) = 7 // so they get benefits from at most 3 military buildings
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5% . Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both
    // get to losing 12.5% each. If an army is far stronger than the order,
    // they lose a small precentage (it goes closer to 0% health loss) while the
    // weak army's loss is closer to 12.5%
    pillageHealthDivisor: 8,
    healthPrecision: 1000n,

    // 25%
    battleLeaveSlashNum: 25,
    battleLeaveSlashDenom: 100,
  },
  mercenaries: {
    troops: {
      knight_count: 1000,
      paladin_count: 1000,
      crossbowman_count: 1000,
    },
    rewards: [
      { resource: ResourcesIds.Wheat, amount: 100 },
      { resource: ResourcesIds.Fish, amount: 200 },
    ],
  },
};

export const config = new EternumConfig(EternumGlobalConfig);

await config.setup(account, provider);
