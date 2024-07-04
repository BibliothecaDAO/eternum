import { useQuestStore } from "@/hooks/store/useQuestStore";
import { QuestInfo } from "./QuestInfo";
import { QuestList } from "./QuestList";

export const QuestPanel = ({ entityId }: { entityId: bigint | undefined }) => {
  const { quests, selectedQuest } = useQuestStore((state) => ({
    quests: state.quests,
    selectedQuest: state.selectedQuest,
  }));

  return selectedQuest ? (
    <div className="p-3 flex flex-col gap-2">
      <QuestInfo quest={selectedQuest} entityId={entityId || BigInt(0)} />
    </div>
  ) : (
    <QuestList quests={quests!} entityId={entityId} />
  );
};
