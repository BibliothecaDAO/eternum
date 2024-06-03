import { ResourcesIds } from "./resources";

export const EternumGlobalConfig = {
  stamina: {
    travelCost: 10,
    exploreCost: 15,
  },
  resources: {
    resourcePrecision: 1000,
    resourceMultiplier: 1000,
    resourceAmountPerTick: 10,
    foodPerTick: 30,
    donkeysPerTick: 3,
    knightsPerTick: 2,
    crossbowmenPerTick: 2,
    paladinPerTick: 2,
  },
  banks: {
    lordsCost: 1000,
    lpFees: 922337203685477580,
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
    wheatBurn: 50,
    fishBurn: 50,
    reward: 20,
    shardsMinesFailProbability: 10000,
  },
  tick: {
    defaultTickIntervalInSeconds: 1,
    armiesTickIntervalInSeconds: 60,
  },
  carryCapacity: {
    donkey: 100,
    army: 100,
  },
  speed: {
    donkey: 1,
    army: 1,
  },
  troop: {
    knightHealth: 10,
    paladinHealth: 10,
    crossbowmanHealth: 10,
    knightStrength: 7,
    paladinStrength: 7,
    crossbowmanStrength: 7,
    advantagePercent: 1000,
    disadvantagePercent: 1000,
  },
};

export enum TickIds {
  Default = 0,
  Armies = 1,
}

export const TROOPS_STAMINAS = {
  [ResourcesIds.Paladin]: 45,
  [ResourcesIds.Knight]: 30,
  [ResourcesIds.Crossbowmen]: 30,
};

export const WORLD_CONFIG_ID = 999999999999999999n;

export const U32_MAX = 4294967295;