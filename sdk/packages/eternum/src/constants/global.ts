import { BUILDING_CAPACITY, BUILDING_POPULATION, BUILDING_RESOURCE_PRODUCED } from "./buildings";
import {
  BUILDING_COSTS,
  HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  HYPERSTRUCTURE_CREATION_COSTS,
  QUEST_RESOURCES,
  RESOURCE_BUILDING_COSTS,
  RESOURCE_INPUTS,
  RESOURCE_OUTPUTS,
  ResourceMultipliers,
  ResourcesIds,
  STRUCTURE_COSTS,
  WEIGHTS,
} from "./resources";
import { TROOPS_STAMINAS } from "./troops";

export const EternumGlobalConfig = {
  hyperstructurePointsPerCycle: 10,
  basePopulationCapacity: 5,
  staminaCost: {
    travel: 5,
    explore: 15,
  },
  resources: {
    resourcePrecision: 1000,
    resourceMultiplier: 1000,
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
  exploration: {
    costs: {
      [ResourcesIds.Wheat]: 100,
      [ResourcesIds.Fish]: 100,
    },
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
    baseArmyNumberForStructure: 3,
    armyExtraPerMilitaryBuilding: 2,
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5% . Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both
    // get to losing 12.5% each. If an army is far stronger than the order,
    // they lose a small precentage (it goes closer to 0% health loss) while the
    // weak army's loss is closer to 12.5%
    pillageHealthDivisor: 8,
    healthPrecision: 1000n,
  },
  mercenaries: {
    troops: {
      knight_count: 4000,
      paladin_count: 4000,
      crossbowman_count: 4000,
    },
    rewards: [
      { resourceId: ResourcesIds.Wheat, amount: 10 },
      { resourceId: ResourcesIds.Fish, amount: 20 },
    ],
  },
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  WEIGHTS,
  RESOURCE_OUTPUTS,
  RESOURCE_INPUTS,
  BUILDING_COSTS,
  STRUCTURE_COSTS,
  RESOURCE_BUILDING_COSTS,
  HYPERSTRUCTURE_CREATION_COSTS,
  HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  QUEST_RESOURCES,
  TROOPS_STAMINAS,
  ResourceMultipliers,
};

export const WORLD_CONFIG_ID = 999999999n;
export const U32_MAX = 4294967295;
export const MAX_NAME_LENGTH = 31;
export const ONE_MONTH = 2628000;

// Buildings
export const STOREHOUSE_CAPACITY = 10000000;

// Entity Types
export const DONKEY_ENTITY_TYPE = 256;
export const REALM_ENTITY_TYPE = 257;
export const ARMY_ENTITY_TYPE = 258;
