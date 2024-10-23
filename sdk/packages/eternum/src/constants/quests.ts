import { ResourcesIds } from ".";
import { ResourceCost } from "../types";

export enum QuestType {
  Food = 1,
  CommonResources,
  UncommonResources,
  UniqueResources,
  RareResources,
  LegendaryResources,
  MythicResources,
  Trade,
  Military,
  FragmentMine,
  Travel,
  Population,
  Market,
  Mine,
  Pillage,
  Hyperstructure,
  Contribution,
  PauseProduction,
  CreateDefenseArmy,
}

export const QUEST_RESOURCES: { [key in QuestType]: ResourceCost[] } = {
  [QuestType.Food]: [
    { resource: ResourcesIds.Wheat, amount: 1000 },
    { resource: ResourcesIds.Fish, amount: 1000 },
  ],
  [QuestType.CommonResources]: [
    { resource: ResourcesIds.Wood, amount: 5 },
    { resource: ResourcesIds.Stone, amount: 5 },
    { resource: ResourcesIds.Coal, amount: 5 },
    { resource: ResourcesIds.Copper, amount: 5 },
  ],
  [QuestType.UncommonResources]: [
    { resource: ResourcesIds.Obsidian, amount: 5 },
    { resource: ResourcesIds.Silver, amount: 5 },
    { resource: ResourcesIds.Ironwood, amount: 5 },
  ],
  [QuestType.UniqueResources]: [
    { resource: ResourcesIds.ColdIron, amount: 5 },
    { resource: ResourcesIds.Gold, amount: 5 },
    { resource: ResourcesIds.Hartwood, amount: 5 },
    { resource: ResourcesIds.Diamonds, amount: 5 },
  ],
  [QuestType.RareResources]: [
    { resource: ResourcesIds.Sapphire, amount: 5 },
    { resource: ResourcesIds.Ruby, amount: 5 },
    { resource: ResourcesIds.DeepCrystal, amount: 5 },
  ],
  [QuestType.LegendaryResources]: [
    { resource: ResourcesIds.Ignium, amount: 5 },
    { resource: ResourcesIds.EtherealSilica, amount: 5 },
    { resource: ResourcesIds.TrueIce, amount: 5 },
    { resource: ResourcesIds.TwilightQuartz, amount: 5 },
  ],
  [QuestType.MythicResources]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 5 },
    { resource: ResourcesIds.Adamantine, amount: 5 },
    { resource: ResourcesIds.Mithral, amount: 5 },
    { resource: ResourcesIds.Dragonhide, amount: 5 },
  ],
  [QuestType.Trade]: [{ resource: ResourcesIds.Donkey, amount: 3 }],
  [QuestType.Military]: [
    { resource: ResourcesIds.Knight, amount: 3 },
    { resource: ResourcesIds.Crossbowman, amount: 3 },
    { resource: ResourcesIds.Paladin, amount: 3 },
  ],
  [QuestType.FragmentMine]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Travel]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Population]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Market]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Mine]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Pillage]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Hyperstructure]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.Contribution]: [{ resource: ResourcesIds.AncientFragment, amount: 5 }],
  [QuestType.PauseProduction]: [{ resource: ResourcesIds.AncientFragment, amount: 2.5 }],
  [QuestType.CreateDefenseArmy]: [{ resource: ResourcesIds.AncientFragment, amount: 2.5 }],
};
