import { Prize } from "@/hooks/helpers/useQuests";
import { QuestType } from "@bibliothecadao/eternum";

interface StaticQuestInfo {
  description: string;
  steps: string[];
  prizes: Prize[];
  depth: number;
}

export enum QuestName {
  Settle = "Settle",
  BuildFarm = "Build a Farm",
  BuildResource = "Build a Resource Facility",
  CreateTrade = "Create a Trade",
  CreateArmy = "Create an Army",
  Travel = "Travel with your Army",
  BuildWorkersHut = "Build a workers hut",
  Market = "Build a market",
  Pillage = "Pillage a structure",
  Mine = "Discover an earthenshard mine",
  Contribution = "Contribute to a hyperstructure",
  Hyperstructure = "Build a hyperstructure",
}

export const questDetails = new Map<QuestName, StaticQuestInfo>([
  [
    QuestName.Settle,
    {
      description: "A gift of food from the gods",
      steps: ["Settle your first Realm"],
      prizes: [{ id: QuestType.Food, title: "Common Resources" }],
      depth: 0,
    },
  ],
  [
    QuestName.BuildFarm,
    {
      description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm",
      steps: [
        "Navigate to the construction menu",
        "Select the 'Farm' card",
        "Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [
        { id: QuestType.CommonResources, title: "Common Resources" },
        { id: QuestType.UncommonResources, title: "Uncommon Resources" },
        { id: QuestType.RareResources, title: "Rare Resources" },
        { id: QuestType.UniqueResources, title: "Unique Resources" },
        { id: QuestType.LegendaryResources, title: "Legendary Resources" },
        { id: QuestType.MythicResources, title: "Mythic Resources" },
      ],
      depth: 1,
    },
  ],
  [
    QuestName.BuildResource,
    {
      description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently",
      steps: [
        "Navigate to the construction menu",
        "Navigate to the 'Resources' tab and select a resource card",
        "Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [{ id: QuestType.Trade, title: "Donkeys and Lords" }],
      depth: 2,
    },
  ],
  [
    QuestName.CreateTrade,
    {
      description: "Trading is the lifeblood of Eternum. Create a trade to start your economy",
      steps: [],
      prizes: [{ id: QuestType.Military, title: "Claim Starting Army" }],
      depth: 3,
    },
  ],
  [
    QuestName.CreateArmy,
    {
      description: "Conquest is fulfilling. Create an army to conquer your enemies",
      steps: ["Create an army to conquer your enemies", "Assign troops to your army"],
      prizes: [{ id: QuestType.Earthenshard, title: "Claim Earthen Shard" }],
      depth: 4,
    },
  ],
  [
    QuestName.Travel,
    {
      description: "Travel with your army",
      steps: ["Go to world view", "Right click on your army", "Travel w/ your army"],
      prizes: [{ id: QuestType.Travel, title: "Travel" }],
      depth: 5,
    },
  ],
  [
    QuestName.BuildWorkersHut,
    {
      description: "Build worker huts to extend your population capacity",
      steps: [],
      prizes: [{ id: QuestType.Population, title: "Population" }],
      depth: 6,
    },
  ],
  [
    QuestName.Market,
    {
      description: "Build a market to produce donkeys. Donkeys are a resource used to transport goods",
      steps: [],
      prizes: [{ id: QuestType.Market, title: "Market" }],
      depth: 6,
    },
  ],
  [
    QuestName.Pillage,
    {
      description: "Pillage a realm, hyperstructure or earthenshard mine",
      steps: [],
      prizes: [{ id: QuestType.Pillage, title: "Pillage" }],
      depth: 6,
    },
  ],
  [
    QuestName.Mine,
    {
      description: "Explore the world, find earthenshard mines",
      steps: [],
      prizes: [{ id: QuestType.Mine, title: "Mine" }],
      depth: 6,
    },
  ],
  [
    QuestName.Contribution,
    {
      description: "Contribute to a Hyperstructure",
      steps: [],
      prizes: [{ id: QuestType.Contribution, title: "Contribution" }],
      depth: 6,
    },
  ],
  [
    QuestName.Hyperstructure,
    {
      description: "Build a Hyperstructure",
      steps: [],
      prizes: [{ id: QuestType.Hyperstructure, title: "Hyperstructure" }],
      depth: 6,
    },
  ],
]);
