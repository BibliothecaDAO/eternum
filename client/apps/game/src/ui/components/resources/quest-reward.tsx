import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";
import { currencyFormat } from "../../utils/utils";

export const QuestReward = ({ quest }: { quest: any }) => {
  if (!quest) return null;

  const reward = quest?.amount ?? 0;
  const resourceId = quest?.resource_type ?? 0;
  return (
    <div className="flex flex-row gap-2">
      <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
      <span className="text-sm">{currencyFormat(Number(reward), 0)}</span>
    </div>
  );
};
