import { QuestType, ResourcesIds, type ResourceCost } from "@bibliothecadao/eternum";

export const QUEST_RESOURCES: { [key in QuestType]: ResourceCost[] } = {
    [QuestType.Settle]: [
      { resource: ResourcesIds.Wheat, amount: 1_200_000 },
      { resource: ResourcesIds.Fish, amount: 1_200_000 },
    ],
  
    [QuestType.BuildFood]: [
      { resource: ResourcesIds.Wood, amount: 5_000 },
      { resource: ResourcesIds.Stone, amount: 5_000 },
      { resource: ResourcesIds.Coal, amount: 5_000 },
      { resource: ResourcesIds.Copper, amount: 5_000 },
      { resource: ResourcesIds.Obsidian, amount: 5_000 },
      { resource: ResourcesIds.Silver, amount: 5_000 },
      { resource: ResourcesIds.Ironwood, amount: 5_000 },
      { resource: ResourcesIds.ColdIron, amount: 5_000 },
      { resource: ResourcesIds.Gold, amount: 5_000 },
      { resource: ResourcesIds.Hartwood, amount: 5_000 },
      { resource: ResourcesIds.Diamonds, amount: 5_000 },
      { resource: ResourcesIds.Sapphire, amount: 5_000 },
      { resource: ResourcesIds.Ruby, amount: 5_000 },
      { resource: ResourcesIds.DeepCrystal, amount: 5_000 },
      { resource: ResourcesIds.Ignium, amount: 5_000 },
      { resource: ResourcesIds.EtherealSilica, amount: 5_000 },
      { resource: ResourcesIds.TrueIce, amount: 5_000 },
      { resource: ResourcesIds.TwilightQuartz, amount: 5_000 },
      { resource: ResourcesIds.AlchemicalSilver, amount: 5_000 },
      { resource: ResourcesIds.Adamantine, amount: 5_000 },
      { resource: ResourcesIds.Mithral, amount: 5_000 },
      { resource: ResourcesIds.Dragonhide, amount: 5_000 },
    ],
    [QuestType.BuildResource]: [{ resource: ResourcesIds.Donkey, amount: 200 }],
    [QuestType.PauseProduction]: [
      { resource: ResourcesIds.Knight, amount: 500 },
      { resource: ResourcesIds.Crossbowman, amount: 500 },
      { resource: ResourcesIds.Paladin, amount: 500 },
    ],
    [QuestType.CreateAttackArmy]: [
      { resource: ResourcesIds.Knight, amount: 500 },
      { resource: ResourcesIds.Paladin, amount: 500 },
      { resource: ResourcesIds.Crossbowman, amount: 500 },
    ],
    [QuestType.CreateDefenseArmy]: [{ resource: ResourcesIds.Donkey, amount: 200 }],
    [QuestType.Travel]: [{ resource: ResourcesIds.Donkey, amount: 200 }],
    [QuestType.CreateTrade]: [
      { resource: ResourcesIds.Donkey, amount: 200 },
      { resource: ResourcesIds.Paladin, amount: 200 },
      { resource: ResourcesIds.Knight, amount: 200 },
      { resource: ResourcesIds.Crossbowman, amount: 200 },
      { resource: ResourcesIds.AncientFragment, amount: 200 },
    ],
  };
  