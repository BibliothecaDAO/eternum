import { QuestType } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import { QuestStatus, useQuests } from "./helpers/useQuests";
import useUIStore from "./store/useUIStore";
import { questSteps, useTutorial } from "./use-tutorial";

export const useStartingTutorial = () => {
  const { handleStart } = useTutorial(questSteps.get(QuestType.Settle), false);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const { quests } = useQuests();

  const settleQuest = quests.find((quest) => quest.id === QuestType.Settle);

  useEffect(() => {
    if (settleQuest?.status !== QuestStatus.Claimed && !showBlankOverlay) {
      handleStart();
    }
  }, [settleQuest?.status, showBlankOverlay, handleStart]);
};
