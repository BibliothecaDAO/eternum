import { ResourcesIds } from "../constants";
import { Resource, ResourceInputs, ResourceOutputs } from "./common";

export interface EternumConfig {
  staminaCost: {
    travel: number;
    explore: number;
  };
  resources: {
    startingResources: Resource[];
  };
  banks: {
    lordsCost: number;
    lpFeesNumerator: number;
    lpFeesDenominator: number;
    ownerFeesNumerator: number;
    ownerFeesDenominator: number;
  };
  populationCapacity: {
    base: number;
    workerHuts: number;
  };
  exploration: {
    burn: { [key: number]: number };
    reward: number;
    shardsMinesFailProbability: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number;
  };
  carryCapacityGram: {
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
    maxTroopCount: number;
    pillageHealthDivisor: number;
    baseArmyNumberForStructure: number;
    armyExtraPerMilitaryBuilding: number;
    battleLeaveSlashNum: number;
    battleLeaveSlashDenom: number;
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
  WEIGHTS_GRAM: { [key: number]: number };
  RESOURCE_OUTPUTS: ResourceOutputs;
  RESOURCE_INPUTS: ResourceInputs;
  BUILDING_COSTS: ResourceInputs;
  RESOURCE_BUILDING_COSTS: ResourceInputs;
  HYPERSTRUCTURE_CREATION_COSTS: { resource: number; amount: number }[];
  HYPERSTRUCTURE_CONSTRUCTION_COSTS: { resource: number; amount: number }[];
  STRUCTURE_COSTS: ResourceInputs;
  QUEST_RESOURCES: { [key: number]: { resource: number; amount: number }[] };
  TROOPS_STAMINAS: { [key: number]: number };
  STAMINA_REFILL_PER_TICK: number;
}
