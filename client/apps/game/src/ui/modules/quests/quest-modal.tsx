import { syncQuests } from "@/dojo/sync";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { getEntityIdFromKeys, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
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
      components: { Tile, QuestTile, QuestLevels },
    },
  } = useDojo();
  const [activeTab, setActiveTab] = useState<ModalTab>(ModalTab.Quest);
  const { setScores } = useMinigameStore();

  const queryAddress = useMemo(() => account?.address ?? "0x0", [account]);

  const questTileEntity = useMemo(() => {
    const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
    return getComponentValue(QuestTile, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0)]));
  }, [targetHex]);

  const queryGameAddress = useMemo(() => {
    const questLevelsEntity = getComponentValue(
      QuestLevels,
      getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
    );
    return questLevelsEntity?.game_address ?? "0x0";
  }, [questTileEntity]);

  const attributeFilters = useMemo(() => {
    return [questTileEntity?.id];
  }, [questTileEntity]);

  const { data: questGames, loading: loadingQuests } = useOwnedGamesWithScores({
    address: queryAddress,
    gameAddress: toHexString(BigInt(queryGameAddress)),
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

  useEffect(() => {
    const fetchQuests = async () => {
      try {
        await syncQuests(setup, questTileEntity?.game_address as string, questGames);
      } catch (error) {
        console.log(error);
      }
    };
    fetchQuests();
  }, [questGamesKey, questTileEntity?.game_address]);

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
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            {activeTab === ModalTab.Quest ? (
              <QuestContainer explorerEntityId={explorerEntityId} targetHex={targetHex} loadingQuests={loadingQuests} />
            ) : activeTab === ModalTab.Info ? (
              <InfoContainer targetHex={targetHex} />
            ) : (
              <RealmsContainer
                explorerEntityId={explorerEntityId}
                targetHex={targetHex}
                loadingQuests={loadingQuests}
              />
            )}
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
