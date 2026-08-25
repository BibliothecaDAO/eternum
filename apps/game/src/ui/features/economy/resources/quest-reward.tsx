import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/types";

interface QuestRewardSource {
  amount: bigint | number | string;
  resource_type: number;
}

export const QuestReward = ({ quest }: { quest: QuestRewardSource }) => {
  if (!quest) return null;

  const reward = quest?.amount ?? 0;
  const resourceId = quest?.resource_type ?? 0;
  return (
    <div className="flex flex-row items-center gap-2">
      <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
      <span className="text-sm">{currencyFormat(Number(reward), 0)}</span>
    </div>
  );
};
