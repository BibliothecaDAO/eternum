import { QuestType } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import { useUIStore } from "../store/ui";
import { QuestStatus, useQuests } from "./use-quests";
import { questSteps, useTutorial } from "./use-tutorial";

export const useStartingTutorial = () => {
  const { handleStart } = useTutorial(questSteps.get(QuestType.Settle));
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const { quests } = useQuests();

  const settleQuest = quests.find((quest) => quest.id === QuestType.Settle);
  const tutorialCompleted = localStorage.getItem("tutorial") === "completed";

  useEffect(() => {
    if (!tutorialCompleted && settleQuest?.status !== QuestStatus.Claimed && !showBlankOverlay) {
      handleStart();
    }
  }, [settleQuest?.status, showBlankOverlay, handleStart]);
};
