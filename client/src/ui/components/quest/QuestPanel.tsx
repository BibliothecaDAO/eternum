import { useQuestStore } from "@/hooks/store/useQuestStore";
import { QuestInfo } from "./QuestInfo";
import { QuestList } from "./QuestList";
import { useQuests } from "@/hooks/helpers/useQuests";
import { useMemo } from "react";

export const QuestPanel = ({ entityId }: { entityId: bigint | undefined }) => {
  const { selectedQuest } = useQuestStore((state) => ({
    selectedQuest: state.selectedQuest,
  }));

  const { quests } = useQuests();
  const updatedSelectedQuest = quests.find((quest) => quest.name === selectedQuest?.name);

  return selectedQuest ? (
    <div className="p-3 flex flex-col gap-2">
      <QuestInfo quest={updatedSelectedQuest!} entityId={entityId || BigInt(0)} />
    </div>
  ) : (
    <QuestList quests={quests || []} entityId={entityId} />
  );
};
