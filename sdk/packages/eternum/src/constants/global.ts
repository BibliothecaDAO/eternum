import { ResourcesIds } from "./resources";

export const EternumGlobalConfig = {
  stamina: {
    travelCost: 5,
    exploreCost: 15,
  },
  resources: {
    resourcePrecision: 1000,
    resourceMultiplier: 1000,
    resourceAmountPerTick: 10,
    foodPerTick: 30,
    donkeysPerTick: 3,
    knightsPerTick: 2,
    crossbowmanPerTick: 2,
    paladinPerTick: 2,
    startingResourcesInputProductionFactor: 4,
    startingResources: [
      { resourceId: ResourcesIds.Wheat, amount: 1500 },
      { resourceId: ResourcesIds.Fish, amount: 1500 },
    ],
  },
  banks: {
    lordsCost: 1000,
    lpFeesNumerator: 15,
    lpFeesDenominator: 100, // %
    ownerFeesNumerator: 15,
    ownerFeesDenominator: 100, // %
  },
  weights: {
    resource: 1000,
    currency: 1,
    food: 100,
  },
  populationCapacity: {
    workerHuts: 5,
  },
  exploration: {
    wheatBurn: 100,
    fishBurn: 100,
    reward: 750,
    shardsMinesFailProbability: 99000,
  },
  tick: {
    defaultTickIntervalInSeconds: 1,
    armiesTickIntervalInSeconds: 7200, // 2hrs
  },
  carryCapacity: {
    donkey: 100,
    army: 10,
  },
  speed: {
    donkey: 60,
    army: 1,
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
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5% . Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both
    // get to losing 12.5% each. If an army is far stronger than the order,
    // they lose a small precentage (it goes closer to 0% health loss) while the
    // weak army's loss is closer to 12.5%
    pillageHealthDivisor: 8,
    healthPrecision: 1000000n,
  },
  mercenaries: {
    troops: {
      knight_count: 4000,
      paladin_count: 4000,
      crossbowman_count: 4000,
    },
    rewards: [
      { resource: ResourcesIds.Gold, amount: 200 },
      { resource: ResourcesIds.Fish, amount: 100 },
    ],
  },
};

export const WORLD_CONFIG_ID = 999999999999999999n;
export const U32_MAX = 4294967295;
export const MAX_NAME_LENGTH = 31;
export const ONE_MONTH = 2628000;

// Buildings
export const BASE_POPULATION_CAPACITY = 5;
export const STOREHOUSE_CAPACITY = 10000000;

// Points
export const HYPERSTRUCTURE_POINTS_PER_CYCLE = 10;

// Entity Types
export const DONKEY_ENTITY_TYPE = 256;
export const REALM_ENTITY_TYPE = 257;
export const ARMY_ENTITY_TYPE = 258;
