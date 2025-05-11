import { useAddressStore } from "@/hooks/store/use-address-store";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { CurrentQuest } from "@/ui/components/quest/quest-realm-component";
import { useGetQuests } from "@/ui/components/quest/quest-utils";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { getArmy, getRemainingCapacityInKg, toHexString } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure, useGetQuestForExplorer, usePlayerStructures } from "@bibliothecadao/react";
import { ContractAddress, type ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useSubscribeScores } from "metagame-sdk";
import { useMemo, useState } from "react";
import gameImage from "../../../assets/games/dark-shuffle.png";

export const QuestContainer = ({
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
      systemCalls: { start_quest, get_game_count },
      components,
      components: { QuestTile, Tile, QuestLevels },
    },
  } = useDojo();
  const playerStructures = usePlayerStructures();

  const addressName = useAddressStore((state) => state.addressName) ?? "test";

  const [loading, setLoading] = useState(false);

  const selectedHex = useUIStore((state) => state.selectedHex);

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
  const questTileEntity = getComponentValue(QuestTile, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0)]));
  const questLevelsEntity = getComponentValue(
    QuestLevels,
    getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
  );
  const questLevels = questLevelsEntity?.levels ?? [];
  const questLevel = questLevels[questTileEntity?.level ?? 0];

  const settingsMetadata = useMinigameStore((state) => state.settingsMetadata);
  const scores = useMinigameStore((state) => state.scores);
  const updateScore = useMinigameStore((state) => state.updateScore);
  const queryGameAddress = useMemo(() => questLevelsEntity?.game_address ?? "0x0", [questLevelsEntity]);

  const quests = useGetQuests(questTileEntity?.game_address as string, questTileEntity?.id ?? 0);

  const handleStartQuest = async () => {
    if (!selectedHex) return;

    try {
      setLoading(true);

      const currentGameCountResult = await get_game_count({
        game_address: questTileEntity?.game_address as string,
        signer: account,
      });

      const currentGameCount = Number(currentGameCountResult[0]);

      // Start the quest transaction
      await start_quest({
        signer: account,
        quest_tile_id: questTileEntity?.id ?? 0,
        explorer_id: explorerEntityId,
        player_name: addressName.replace(/\0/g, ""),
        to_address: account?.address,
      });

      window.open(`https://darkshuffle.dev/play/${Number(currentGameCount + 1)}`, "_blank");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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

  const rewardAmount = questTileEntity?.amount ?? 0;

  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(explorerEntityId)]));

  const remainingExplorerCapacity = useMemo(() => getRemainingCapacityInKg(resources!), [resources]);

  const explorerHasEnoughCapacity = useMemo(() => {
    return remainingExplorerCapacity >= Number(rewardAmount) / 10 ** 9;
  }, [remainingExplorerCapacity, rewardAmount]);

  const currentQuestEntity = useGetQuestForExplorer(explorerEntityId, questTileEntity?.id ?? 0);

  const currentQuest = getComponentValue(components.Quest, currentQuestEntity);

  const game = scores?.[Number(currentQuest?.game_token_id ?? 0)];
  const currentRealm = realmsOrVillages.find(
    (realm) => realm.structure.metadata.realm_id === armyInfo?.structure?.metadata?.realm_id,
  );

  const explorers = useExplorersByStructure({ structureEntityId: currentRealm?.entityId ?? 0 });

  // check whether there is a realm explorer that has already started the quest
  const realmExplorerStartedQuest = quests.some((quest) =>
    explorers.some((explorer) => explorer.entityId === quest?.explorer_id),
  );

  useSubscribeScores({
    gameAddress: toHexString(BigInt(queryGameAddress)),
    onScoreUpdate: (score) => {
      if (score.token_id) {
        updateScore(score);
      }
    },
  });

  const settingName = settingsMetadata
    ?.find((setting) => setting.settings_id === questLevel?.value?.settings_id?.value)
    ?.name.split("Eternum Quest -")[1];

  return (
    <div className="flex flex-col gap-5 text-xl w-3/5 mx-auto h-full overflow-y-auto pt-2 border border-gold/20 rounded-lg">
      <div className="flex flex-col justify-center mx-auto h-[200px] w-full">
        <img src={gameImage} alt="Dark Shuffle" className="object-cover w-full h-full object-center" />
      </div>
      <div className="flex flex-col justify-center px-5 w-full text-center">
        Quests provide rewards from completing challenges in other games.
      </div>
      <div className="flex flex-row justify-between items-center w-3/4 p-5 mx-auto border border-gold/20 bg-gold/10 rounded-lg">
        <div className="flex flex-col items-center gap-2 w-1/3">
          <span className="text-gold/80">Reward</span>
          <span className="flex flex-row gap-2 items-center text-2xl font-bold text-gold">
            <ResourceIcon resource={ResourcesIds[questTileEntity?.resource_type ?? 0]} size="lg" />
            <span>{currencyFormat(Number(rewardAmount), 0)}</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 w-1/3">
          <span className="text-gold/80">Difficulty</span>
          <span className="text-2xl font-bold text-gold">{settingName}</span>
        </div>
        <div className="flex flex-col items-center gap-2 w-1/3">
          <span className="text-gold/80">Cost</span>
          <span className="text-2xl font-bold text-gold">Free</span>
        </div>
      </div>
      {currentRealm && (
        <div className="w-3/4 h-full mx-auto">
          <CurrentQuest
            handleStartQuest={handleStartQuest}
            loading={loading}
            setLoading={setLoading}
            questLevelInfo={questLevel}
            structureInfo={currentRealm}
            armyInfo={armyInfo!}
            quest={currentQuest!}
            game={game!}
            fullCapacity={fullCapacity}
            loadingQuests={loadingQuests}
            explorerHasEnoughCapacity={explorerHasEnoughCapacity}
            realmExplorerStartedQuest={realmExplorerStartedQuest}
            gameAddress={questTileEntity?.game_address!}
            questTile={questTileEntity}
          />
        </div>
      )}
    </div>
  );
};
