import { useQuests } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import { ID } from "@bibliothecadao/eternum";
import { QuestInfo } from "./QuestInfo";
import { QuestList } from "./QuestList";

export const QuestPanel = ({ entityId }: { entityId: ID | undefined }) => {
  const { selectedQuest } = useQuestStore((state) => ({
    selectedQuest: state.selectedQuest,
  }));

  const { quests } = useQuests();
  const updatedSelectedQuest = quests.find((quest) => quest.id === selectedQuest?.id);

  return selectedQuest ? (
    <div className="p-3 flex flex-col gap-2 ">
      <QuestInfo quest={updatedSelectedQuest!} entityId={entityId || 0} />
    </div>
  ) : (
    <QuestList quests={quests || []} entityId={entityId} />
  );
};
