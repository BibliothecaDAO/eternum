import { Prize } from "@/hooks/helpers/useQuests";
import { QuestType } from "@bibliothecadao/eternum";

interface StaticQuestInfo {
  name: string;
  prizes: Prize[];
  depth: number;
}

export const questDetails = new Map<QuestType, StaticQuestInfo>([
  [
    QuestType.Settle,
    {
      name: "A Gift From The Gods",
      prizes: [{ id: QuestType.Settle, title: "Food" }],
      depth: 0,
    },
  ],
  [
    QuestType.BuildFood,
    {
      name: "Build a Farm or a Fishing Village",
      prizes: [{ id: QuestType.BuildFood, title: "Resources" }],
      depth: 1,
    },
  ],
  [
    QuestType.BuildResource,
    {
      name: "Build a Resource Facility",
      prizes: [{ id: QuestType.BuildResource, title: "Donkeys" }],
      depth: 2,
    },
  ],
  [
    QuestType.PauseProduction,
    {
      name: "Pause Production",
      prizes: [{ id: QuestType.PauseProduction, title: "Pause Production" }],
      depth: 3,
    },
  ],
  [
    QuestType.CreateDefenseArmy,
    {
      name: "Create a Defensive Army",
      prizes: [{ id: QuestType.CreateDefenseArmy, title: "Create Defensive Army" }],
      depth: 4,
    },
  ],
  [
    QuestType.CreateAttackArmy,
    {
      name: "Create an Attacking Army",
      prizes: [{ id: QuestType.CreateAttackArmy, title: "Claim Attacking Army" }],
      depth: 5,
    },
  ],
  [
    QuestType.Travel,
    {
      name: "Move with your Army",
      prizes: [{ id: QuestType.Travel, title: "Travel" }],
      depth: 6,
    },
  ],
  [
    QuestType.CreateTrade,
    {
      name: "Create a Trade",
      prizes: [{ id: QuestType.CreateTrade, title: "Claim Starting Army" }],
      depth: 7,
    },
  ],
]);
