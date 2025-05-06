import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { currencyFormat } from "../../utils/utils";

export const QuestReward = ({ quest }: { quest: ComponentValue<ClientComponents["QuestTile"]["schema"]> }) => {
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
