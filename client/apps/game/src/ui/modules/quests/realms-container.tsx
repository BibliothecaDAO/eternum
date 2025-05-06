import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { QuestRealm } from "@/ui/components/quest/quest-realm-component";
import { getQuests } from "@/ui/components/quest/quest-utils";
import { getArmy, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ContractAddress, ID, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const RealmsContainer = ({
  explorerEntityId,
  targetHex,
  loadingQuests,
}: {
  explorerEntityId: ID;
  targetHex: { x: number; y: number };
  loadingQuests: boolean;
}) => {
  const {
    account: { account },
    setup: {
      components,
      components: { Tile, QuestTile, QuestLevels },
    },
  } = useDojo();
  const playerStructures = usePlayerStructures();

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
  const questTileEntity = getComponentValue(QuestTile, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0)]));
  const questLevelsEntity = getComponentValue(
    QuestLevels,
    getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
  );

  const questLevels = questLevelsEntity?.levels ?? [];
  const questLevel = questLevels[questTileEntity?.level ?? 0] as any;

  const scores = useMinigameStore((state) => state.scores);

  const quests = getQuests(components, questTileEntity?.game_address as string, Object.values(scores || {}));

  const armyInfo = getArmy(explorerEntityId, ContractAddress(account?.address), components);

  const realmsOrVillages = useMemo(() => {
    const matchingRealmId = armyInfo?.structure?.metadata?.realm_id;

    return playerStructures
      .filter((structure) => structure.category === StructureType.Realm || structure.category === StructureType.Village)
      .map((structure) => ({
        ...structure,
        // Add a flag to identify if this structure matches the armyInfo
        isMatchingRealm: structure?.structure?.metadata?.realm_id === matchingRealmId,
      }))
      .sort((a, b) => {
        // First sort by matching flag (true comes before false)
        if (a.isMatchingRealm && !b.isMatchingRealm) return -1;
        if (!a.isMatchingRealm && b.isMatchingRealm) return 1;

        // If both match or both don't match, sort by realmId
        const aRealmId = a?.structure?.metadata?.realm_id || 0;
        const bRealmId = b?.structure?.metadata?.realm_id || 0;
        return aRealmId - bRealmId;
      });
  }, [playerStructures, armyInfo?.structure?.metadata?.realm_id]);

  const fullCapacity = useMemo(() => {
    return questTileEntity?.capacity === questTileEntity?.participant_count;
  }, [questTileEntity]);

  return (
    <div className="grid grid-cols-3 gap-3 overflow-y-auto w-3/4 mx-auto pt-5">
      {realmsOrVillages.map((structure) => {
        return (
          <div className="h-36">
            <QuestRealm
              questLevelInfo={questLevel}
              structureInfo={structure}
              armyInfo={armyInfo!}
              questEntities={quests}
              questGames={scores}
              fullCapacity={fullCapacity}
              loadingQuests={loadingQuests}
            />
          </div>
        );
      })}
    </div>
  );
};
