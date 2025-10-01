import { BuildingThumbs } from "@/ui/config";
import { sqlApi } from "@/services/api";
import { ActionPath, getRemainingCapacityInKg } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { QuestTileData } from "@bibliothecadao/torii";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useEffect, useMemo, useState } from "react";

import { InfoLabel } from "./info-label";
import { formatAmount } from "./format-amount";

interface QuestInfoProps {
  selectedEntityId: ID;
  path: ActionPath[];
}

export const QuestInfo = memo(({ selectedEntityId, path }: QuestInfoProps) => {
  const {
    setup: {
      components: { Tile, Resource },
    },
  } = useDojo();

  const [questTileEntity, setQuestTileEntity] = useState<QuestTileData | undefined>();
  const questCoords = path[path.length - 1].hex;

  useEffect(() => {
    const fetchQuest = async () => {
      const targetEntity = getComponentValue(
        Tile,
        getEntityIdFromKeys([BigInt(questCoords.col), BigInt(questCoords.row)]),
      );
      const result = await sqlApi.fetchQuest(targetEntity?.occupier_id || 0);
      setQuestTileEntity(result ?? undefined);
    };

    fetchQuest();
  }, [Tile, questCoords]);

  const rewardAmount = questTileEntity?.amount ?? 0;

  const resources = useComponentValue(Resource, getEntityIdFromKeys([BigInt(selectedEntityId)]));

  const remainingCapacity = useMemo(() => {
    if (!resources) return 0;
    return getRemainingCapacityInKg(resources);
  }, [resources]);

  const hasEnoughCapacity = useMemo(() => {
    if (!rewardAmount) return true;
    return remainingCapacity >= Number(rewardAmount) / 10 ** 9;
  }, [remainingCapacity, rewardAmount]);

  if (!questTileEntity) return null;

  return (
    <div className="mt-1 flex flex-col gap-1">
      {!hasEnoughCapacity && (
        <InfoLabel variant="attack" className="items-center gap-2 text-left normal-case">
          <span className="text-xl leading-none">⚠️</span>
          <div className="flex flex-col gap-0.5 text-xs font-medium">
            <span className="text-xxs uppercase tracking-wide opacity-80">Capacity Warning</span>
            <span className="text-xs font-normal">Too heavy to claim reward</span>
          </div>
        </InfoLabel>
      )}
      <InfoLabel variant="quest" className="items-center gap-2">
        <img src={BuildingThumbs.resources} className="h-7 w-7 object-contain" />
        <div className="flex flex-col gap-0.5 text-left text-xs font-medium normal-case">
          <span className="text-xxs uppercase tracking-wide opacity-80">Quest Reward</span>
          <span className="text-xs font-semibold normal-case">
            +{formatAmount(Number(rewardAmount) / 10 ** 9)} Random resource
          </span>
        </div>
      </InfoLabel>
    </div>
  );
});
