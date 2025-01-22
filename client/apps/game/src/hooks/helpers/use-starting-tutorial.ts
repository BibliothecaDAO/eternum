import { useUIStore } from "@/hooks/store/use-ui-store";
import { QuestStatus, QuestType } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import { useQuests } from "./use-quests";
import { questSteps, useTutorial } from "./use-tutorial";

export const QUEST_DETAILS = {
  [QuestType.Settle]: {
    name: "A Gift From The Gods",
    prizes: [{ id: QuestType.Settle, title: "Food" }],
    depth: 0,
  },
  [QuestType.BuildFood]: {
    name: "Build a Farm or a Fishing Village",
    prizes: [{ id: QuestType.BuildFood, title: "Resources" }],
    depth: 1,
  },

  [QuestType.BuildResource]: {
    name: "Build a Resource Facility",
    prizes: [{ id: QuestType.BuildResource, title: "Donkeys" }],
    depth: 2,
  },

  [QuestType.PauseProduction]: {
    name: "Pause Production",
    prizes: [{ id: QuestType.PauseProduction, title: "Pause Production" }],
    depth: 3,
  },

  [QuestType.CreateDefenseArmy]: {
    name: "Create a Defensive Army",
    prizes: [{ id: QuestType.CreateDefenseArmy, title: "Create Defensive Army" }],
    depth: 4,
  },

  [QuestType.CreateAttackArmy]: {
    name: "Create an Attacking Army",
    prizes: [{ id: QuestType.CreateAttackArmy, title: "Claim Attacking Army" }],
    depth: 5,
  },

  [QuestType.Travel]: {
    name: "Move with your Army",
    prizes: [{ id: QuestType.Travel, title: "Travel" }],
    depth: 6,
  },

  [QuestType.CreateTrade]: {
    name: "Create a Trade",
    prizes: [{ id: QuestType.CreateTrade, title: "Claim Starting Army" }],
    depth: 7,
  },
} as const;

export const useStartingTutorial = () => {
  const { handleStart } = useTutorial(questSteps.get(QuestType.Settle));
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const quests = useQuests();

  const settleQuest = quests.find((quest) => quest.id === QuestType.Settle);
  const tutorialCompleted = localStorage.getItem("tutorial") === "completed";

  useEffect(() => {
    if (!tutorialCompleted && settleQuest?.status !== QuestStatus.Claimed && !showBlankOverlay) {
      handleStart();
    }
  }, [settleQuest?.status, showBlankOverlay, handleStart]);
};
