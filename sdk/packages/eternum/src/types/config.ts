import { ResourcesIds } from "../constants";
import { Resource, ResourceInputs, ResourceOutputs } from "./common";

export interface EternumConfig {
  hyperstructurePointsPerCycle: number;
  basePopulationCapacity: number;
  staminaCost: {
    travel: number;
    explore: number;
  };
  resources: {
    resourcePrecision: number;
    resourceMultiplier: number;
    startingResourcesInputProductionFactor: number;
    startingResources: Resource[];
  };
  banks: {
    lordsCost: number;
    lpFeesNumerator: number;
    lpFeesDenominator: number;
    ownerFeesNumerator: number;
    ownerFeesDenominator: number;
  };
  weights: {
    resource: number;
    currency: number;
    food: number;
  };
  exploration: {
    costs: { [key: number]: number };
    reward: number;
    shardsMinesFailProbability: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number;
  };
  carryCapacity: {
    donkey: number;
    army: number;
  };
  speed: {
    donkey: number;
    army: number;
  };
  troop: {
    health: number;
    knightStrength: number;
    paladinStrength: number;
    crossbowmanStrength: number;
    advantagePercent: number;
    disadvantagePercent: number;
    pillageHealthDivisor: number;
    healthPrecision: bigint;
  };
  mercenaries: {
    troops: {
      knight_count: number;
      paladin_count: number;
      crossbowman_count: number;
    };
    rewards: { resourceId: ResourcesIds; amount: number }[];
  };
  BUILDING_CAPACITY: { [key: number]: number };
  BUILDING_POPULATION: { [key: number]: number };
  BUILDING_RESOURCE_PRODUCED: { [key: number]: number };
  WEIGHTS: { [key: number]: number };
  RESOURCE_OUTPUTS: ResourceOutputs;
  RESOURCE_INPUTS: ResourceInputs;
  BUILDING_COSTS: ResourceInputs;
  STRUCTURE_COSTS: ResourceInputs;
  RESOURCE_BUILDING_COSTS: ResourceInputs;
  HYPERSTRUCTURE_CREATION_COSTS: { resource: number; amount: number }[];
  HYPERSTRUCTURE_CONSTRUCTION_COSTS: { resource: number; amount: number }[];
  QUEST_RESOURCES: { [key: number]: { resource: number; amount: number }[] };
  TROOPS_STAMINAS: { [key: number]: number };
  ResourceMultipliers: ResourceOutputs;
}
