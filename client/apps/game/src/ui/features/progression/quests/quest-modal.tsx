import { useSyncQuest } from "@/hooks/helpers/use-sync";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { sqlApi } from "@/services/api";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { getEntityIdFromKeys, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { QuestTileData } from "@bibliothecadao/torii";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useOwnedGamesWithScores } from "metagame-sdk";
import { Suspense, useEffect, useMemo, useState } from "react";
import { InfoContainer } from "./info-container";
import { QuestContainer } from "./quest-container";
import { RealmsContainer } from "./realms-container";

enum ModalTab {
  Quest = "Quest",
  Info = "Info",
  Realms = "Realms",
}

export const QuestModal = ({
  explorerEntityId,
  targetHex,
}: {
  explorerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    setup,
    setup: {
      components: { Tile, QuestLevels },
    },
    network: { toriiClient },
  } = useDojo();
  const [activeTab, setActiveTab] = useState<ModalTab>(ModalTab.Quest);
  const [questTileEntity, setQuestTileEntity] = useState<QuestTileData | undefined>(undefined);
  const [loadingQuestTile, setLoadingQuestTile] = useState(true);
  const setScores = useMinigameStore((state) => state.setScores);

  const queryAddress = useMemo(() => account?.address, [account]);

  useEffect(() => {
    const fetchQuest = async () => {
      const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
      const result = await sqlApi.fetchQuest(targetEntity?.occupier_id || 0);
      if (result) {
        setQuestTileEntity(result);
      }
    };
    fetchQuest();
  }, [targetHex, toriiClient]);

  const queryGameAddress = useMemo(() => {
    const questLevelsEntity = getComponentValue(
      QuestLevels,
      getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
    );
    return questLevelsEntity?.game_address ? toHexString(BigInt(questLevelsEntity?.game_address)) : undefined;
  }, [questTileEntity]);

  const attributeFilters = useMemo(() => {
    return [questTileEntity?.id];
  }, [questTileEntity]);

  const { data: questGames, loading: loadingQuests } = useOwnedGamesWithScores({
    address: queryAddress,
    gameAddress: queryGameAddress ?? "",
    metagame: {
      namespace: "s1_eternum",
      model: "Quest",
      attribute: "quest_tile_id",
      key: "game_token_id",
      attributeFilters,
    },
  });

  const questGamesKey = useMemo(() => {
    return questGames.join(",");
  }, [questGames]);

  const { isSyncing } = useSyncQuest();

  useEffect(() => {
    if (questGames?.length > 0) {
      const initialScores = questGames.reduce((acc: Record<string, any>, game: any) => {
        if (game.token_id) {
          acc[Number(game.token_id)] = {
            ...game,
          };
        }
        return acc;
      }, {});

      setScores(initialScores);
    }

    // Cleanup function that runs when component unmounts
    return () => {
      setScores({}); // Reset scores to undefined when component unmounts
    };
  }, [questGamesKey, setScores]);

  useEffect(() => {
    if (questTileEntity) {
      setLoadingQuestTile(false);
    }
  }, [questTileEntity]);

  return (
    <ModalContainer size="large">
      <div className="container mx-auto h-full rounded-2xl relative flex flex-col">
        <div className="flex justify-center border-b border-gold/30">
          <div className="flex">
            {Object.values(ModalTab).map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 text-lg font-semibold ${
                  activeTab === tab ? "text-gold border-b-2 border-gold" : "text-gold/50 hover:text-gold/70"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        {/* Content */}
        {loadingQuestTile || isSyncing ? (
          <LoadingAnimation />
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
            <Suspense fallback={<LoadingAnimation />}>
              {activeTab === ModalTab.Quest ? (
                <QuestContainer
                  explorerEntityId={explorerEntityId}
                  loadingQuests={loadingQuests}
                  questTileEntity={questTileEntity}
                />
              ) : activeTab === ModalTab.Info ? (
                <InfoContainer questTileEntity={questTileEntity} />
              ) : (
                <RealmsContainer
                  explorerEntityId={explorerEntityId}
                  loadingQuests={loadingQuests}
                  questTileEntity={questTileEntity}
                />
              )}
            </Suspense>
          </div>
        )}
      </div>
    </ModalContainer>
  );
};
