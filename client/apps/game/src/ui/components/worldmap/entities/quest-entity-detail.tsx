import { Headline } from "@/ui/elements/headline";
import { ID } from "@bibliothecadao/types";

interface QuestEntityDetailProps {
  questEntityId: ID;
  compact?: boolean;
}

export const QuestEntityDetail = ({ questEntityId, compact = false }: QuestEntityDetailProps) => {
  // const quest = getQuest(questEntityId);
  return (
    <div className="flex flex-col gap-1">
      <Headline className="text-center text-lg">
        <div>{"1"}</div>
      </Headline>
    </div>
  );
};
