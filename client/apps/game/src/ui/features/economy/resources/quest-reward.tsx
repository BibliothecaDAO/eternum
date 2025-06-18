import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { QuestTileData } from "@bibliothecadao/torii";
import { ResourcesIds } from "@bibliothecadao/types";

export const QuestReward = ({ quest }: { quest: QuestTileData }) => {
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
