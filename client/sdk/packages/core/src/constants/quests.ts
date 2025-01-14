import { ResourcesIds } from ".";
import { ResourceCost } from "../types";

export enum QuestType {
  Settle = 1,
  BuildFood,
  BuildResource,
  PauseProduction,
  CreateDefenseArmy,
  CreateAttackArmy,
  Travel,
  CreateTrade,
}

export const QUEST_RESOURCES: { [key in QuestType]: ResourceCost[] } = {
  [QuestType.Settle]: [
    { resource: ResourcesIds.Wheat, amount: 1200 },
    { resource: ResourcesIds.Fish, amount: 1200 },
  ],

  [QuestType.BuildFood]: [
    { resource: ResourcesIds.Wood, amount: 5 },
    { resource: ResourcesIds.Stone, amount: 5 },
    { resource: ResourcesIds.Coal, amount: 5 },
    { resource: ResourcesIds.Copper, amount: 5 },
    { resource: ResourcesIds.Obsidian, amount: 5 },
    { resource: ResourcesIds.Silver, amount: 5 },
    { resource: ResourcesIds.Ironwood, amount: 5 },
    { resource: ResourcesIds.ColdIron, amount: 5 },
    { resource: ResourcesIds.Gold, amount: 5 },
    { resource: ResourcesIds.Hartwood, amount: 5 },
    { resource: ResourcesIds.Diamonds, amount: 5 },
    { resource: ResourcesIds.Sapphire, amount: 5 },
    { resource: ResourcesIds.Ruby, amount: 5 },
    { resource: ResourcesIds.DeepCrystal, amount: 5 },
    { resource: ResourcesIds.Ignium, amount: 5 },
    { resource: ResourcesIds.EtherealSilica, amount: 5 },
    { resource: ResourcesIds.TrueIce, amount: 5 },
    { resource: ResourcesIds.TwilightQuartz, amount: 5 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 5 },
    { resource: ResourcesIds.Adamantine, amount: 5 },
    { resource: ResourcesIds.Mithral, amount: 5 },
    { resource: ResourcesIds.Dragonhide, amount: 5 },
  ],
  [QuestType.BuildResource]: [{ resource: ResourcesIds.Donkey, amount: 0.2 }],
  [QuestType.PauseProduction]: [
    { resource: ResourcesIds.Knight, amount: 0.5 },
    { resource: ResourcesIds.Crossbowman, amount: 0.5 },
    { resource: ResourcesIds.Paladin, amount: 0.5 },
  ],
  [QuestType.CreateAttackArmy]: [
    { resource: ResourcesIds.Knight, amount: 0.5 },
    { resource: ResourcesIds.Paladin, amount: 0.5 },
    { resource: ResourcesIds.Crossbowman, amount: 0.5 },
  ],
  [QuestType.CreateDefenseArmy]: [{ resource: ResourcesIds.Donkey, amount: 1 }],
  [QuestType.Travel]: [{ resource: ResourcesIds.Donkey, amount: 0.2 }],
  [QuestType.CreateTrade]: [
    { resource: ResourcesIds.Donkey, amount: 0.2 },
    { resource: ResourcesIds.Paladin, amount: 1 },
    { resource: ResourcesIds.Knight, amount: 1 },
    { resource: ResourcesIds.Crossbowman, amount: 1 },
    { resource: ResourcesIds.AncientFragment, amount: 0.1 },
  ],
};
