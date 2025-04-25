import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";
import { currencyFormat } from "../../utils/utils";

export const QuestReward = ({ quest }: { quest: any }) => {
  const reward = quest.amount;
  const resourceId = quest.resource_type;
  return (
    <div className="flex flex-row gap-2">
      <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
      <span className="text-sm">{currencyFormat(Number(reward), 0)}</span>
    </div>
  );
};
