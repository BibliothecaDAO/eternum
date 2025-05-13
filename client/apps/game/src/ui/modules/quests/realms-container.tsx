import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { QuestRealm } from "@/ui/components/quest/quest-realm-component";
import { useGetQuests } from "@/ui/components/quest/quest-utils";
import { getArmy, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, ID, StructureType } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const RealmsContainer = ({
  explorerEntityId,
  loadingQuests,
  questTileEntity,
}: {
  explorerEntityId: ID;
  loadingQuests: boolean;
  questTileEntity: ComponentValue<ClientComponents["QuestTile"]["schema"]> | undefined;
}) => {
  const {
    account: { account },
    setup: {
      components,
      components: { QuestLevels },
    },
  } = useDojo();
  const playerStructures = usePlayerStructures();

  const questLevelsEntity = useMemo(() => {
    return getComponentValue(QuestLevels, getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]));
  }, [questTileEntity]);

  const questLevels = questLevelsEntity?.levels ?? [];
  const questLevel = questLevels[questTileEntity?.level ?? 0] as any;

  const scores = useMinigameStore((state) => state.scores);

  const quests = useGetQuests(questTileEntity?.game_address as string, questTileEntity?.id ?? 0);

  const armyInfo = useMemo(
    () => getArmy(explorerEntityId, ContractAddress(account?.address), components),
    [explorerEntityId, account?.address, components],
  );

  const realmsOrVillages = useMemo(() => {
    const matchingStructureEntityId = armyInfo?.structure?.entity_id;

    return playerStructures
      .filter((structure) => structure.category === StructureType.Realm || structure.category === StructureType.Village)
      .map((structure) => ({
        ...structure,
        // Add a flag to identify if this structure matches the armyInfo
        isMatchingStructure: structure?.structure?.entity_id === matchingStructureEntityId,
      }))
      .sort((a, b) => {
        // First sort by matching flag (true comes before false)
        if (a.isMatchingStructure && !b.isMatchingStructure) return -1;
        if (!a.isMatchingStructure && b.isMatchingStructure) return 1;

        // If both match or both don't match, sort by realmId
        const aStructureEntityId = a?.structure?.entity_id || 0;
        const bStructureEntityId = b?.structure?.entity_id || 0;
        return aStructureEntityId - bStructureEntityId;
      });
  }, [playerStructures, armyInfo?.structure?.entity_id]);

  const fullCapacity = useMemo(() => {
    return questTileEntity?.capacity === questTileEntity?.participant_count;
  }, [questTileEntity]);

  if (!armyInfo) return null;

  return (
    <div className="grid grid-cols-3 gap-3 overflow-y-auto w-3/4 mx-auto p-5">
      {realmsOrVillages.map((structure, index) => {
        return (
          <div className="h-36" key={index}>
            <QuestRealm
              questLevelInfo={questLevel}
              structureInfo={structure}
              armyInfo={armyInfo}
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
