import { QuestId } from "@/ui/components/quest/questDetails";
import { questSteps } from "@/ui/components/quest/QuestList";
import { useEffect } from "react";
import { QuestStatus, useQuests } from "./helpers/useQuests";
import useUIStore from "./store/useUIStore";
import { useTutorial } from "./use-tutorial";

export const useStartingTutorial = () => {
  const { handleStart } = useTutorial(questSteps.get(QuestId.Settle));
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const { quests } = useQuests();

  const settleQuest = quests.find((quest) => quest.id === QuestId.Settle);

  useEffect(() => {
    console.log({ settleQuest, showBlankOverlay });

    if (settleQuest?.status !== QuestStatus.Claimed && !showBlankOverlay) {
      handleStart();
    }
  }, [settleQuest?.status, showBlankOverlay]);
};
