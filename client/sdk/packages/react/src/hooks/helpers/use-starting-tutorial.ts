import { useQuests } from "@/hooks/helpers/use-quests";
import useUIStore from "@/hooks/store/use-ui-store";
import { questSteps, useTutorial } from "@/hooks/use-tutorial";
import { QuestStatus, QuestType } from "@bibliothecadao/eternum";
import { useEffect } from "react";

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
