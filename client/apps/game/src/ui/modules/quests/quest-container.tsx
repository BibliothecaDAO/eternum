import { useAddressStore } from "@/hooks/store/use-address-store";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { QuestRealm } from "@/ui/components/quest/quest-realm-component";
import { getQuestForExplorer, getQuests } from "@/ui/components/quest/quest-utils";
import { BuildingThumbs } from "@/ui/config";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { divideByPrecision, formatTime, getArmy, getRemainingCapacityInKg, toHexString } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ContractAddress, type ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useOwnedGamesWithScores } from "metagame-sdk";
import { useEffect, useMemo, useState } from "react";
import gameImage from "../../../assets/games/dark-shuffle.png";

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};

export const QuestContainer = ({
  explorerEntityId,
  targetHex,
}: {
  explorerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { start_quest, claim_reward },
      components,
      components: { QuestTile, Quest, Tile, QuestLevels },
      network: { toriiClient },
    },
  } = useDojo();
  const playerStructures = usePlayerStructures();
  const [questEntities, setQuestEntities] = useState<any[]>([]);

  const addressName = useAddressStore((state) => state.addressName) ?? "test";

  const [loading, setLoading] = useState(false);
  const [loadingQuests, setLoadingQuests] = useState(false);

  const selectedHex = useUIStore((state) => state.selectedHex);

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
  const questTileEntity = getComponentValue(QuestTile, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0)]));
  const questLevelsEntity = getComponentValue(
    QuestLevels,
    getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
  );
  const questLevels = questLevelsEntity?.levels ?? [];
  const questLevel = questLevels[questTileEntity?.level ?? 0] as any;
  const timeLimit = questLevel?.value?.time_limit?.value;

  const minigames = useMinigameStore((state) => state.minigames);
  const settingsMetadata = useMinigameStore((state) => state.settingsMetadata);

  const queryAddress = useMemo(() => account?.address ?? "0x0", [account]);
  const queryGameAddress = useMemo(() => questLevelsEntity?.game_address ?? "0x0", [questLevelsEntity]);

  const attributeFilters = useMemo(() => {
    return [questTileEntity?.id];
  }, [questTileEntity]);

  console.log(queryAddress, queryGameAddress, attributeFilters);

  const { data: questGames, refetch: refetchQuestGames } = useOwnedGamesWithScores({
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
        setLoadingQuests(true);
        const quests = await getQuests(
          toriiClient,
          components as any,
          questTileEntity?.game_address as string,
          questGames,
        );
        setQuestEntities(quests);
        console.log(quests);
        setLoadingQuests(false);
      } catch (error) {
        console.log(error);
        setLoadingQuests(false);
      }
      // try {
      //   console.log(await getQuestsFromTorii(toriiClient, components as any, questTileEntity?.id!));
      //   await getQuestsFromTorii(toriiClient, components as any, questTileEntity?.id!);
      // } catch (error) {
      //   console.error(error);
      // }
      // const quest = getQuestForExplorer(components, explorerEntityId);
      // console.log(quest);
    };
    fetchQuests();
  }, [questGamesKey, questTileEntity?.game_address]);

  console.log(components.Quest);

  const handleStartQuest = async () => {
    if (!selectedHex) return;

    try {
      setLoading(true);

      // Start the quest transaction
      await start_quest({
        signer: account,
        quest_tile_id: questTileEntity?.id ?? 0,
        explorer_id: explorerEntityId,
        player_name: "test",
        to_address: account?.address,
      });

      // Poll for the quest with a retry mechanism
      const quest = await pollForQuest(explorerEntityId, 10, 1000); // 10 retries, 1000ms interval

      if (quest) {
        window.open(`https://darkshuffle.dev/play/${Number(quest.game_token_id)}`, "_blank");
      } else {
        console.error("Failed to retrieve quest after multiple retries");
        // Optionally show user feedback
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to poll for the quest with retries
  const pollForQuest = async (explorerEntityId: number, maxRetries = 10, interval = 5000) => {
    let retries = 0;

    // Create a promise that resolves when the quest is found
    return new Promise<any>((resolve, reject) => {
      const attemptFetch = async () => {
        try {
          // Try to get the quest
          const quest = await getQuestForExplorer(toriiClient, components, explorerEntityId);

          // If quest exists and has a game_token_id, we're good
          if (quest && quest.game_token_id) {
            console.log(`Quest found after ${retries + 1} attempts`);
            return resolve(quest);
          }

          // If we've reached max retries, resolve with null
          if (++retries >= maxRetries) {
            console.log(`Max retries (${maxRetries}) reached without finding quest`);
            return resolve(null);
          }

          // Schedule another attempt
          console.log(`Quest not found yet, retrying in ${interval}ms... (${retries}/${maxRetries})`);
          setTimeout(attemptFetch, interval);
        } catch (error) {
          // If there's an error fetching the quest, log it but continue retrying
          console.error(`Error fetching quest (attempt ${retries}/${maxRetries}):`, error);

          // If we've reached max retries, reject
          if (++retries >= maxRetries) {
            return reject(new Error(`Failed to fetch quest after ${maxRetries} retries`));
          }

          // Schedule another attempt
          setTimeout(attemptFetch, interval);
        }
      };

      // Start the first attempt
      attemptFetch();
    });
  };

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

  useEffect(() => {
    const fetchQuest = async () => {
      const quest = await getQuestForExplorer(toriiClient, components, explorerEntityId);
    };
    fetchQuest();
  }, [toriiClient, components, explorerEntityId]);

  // const explorerGame = questEntities.find((quest) => quest.explorer_id === explorerEntityId);

  const fullCapacity = useMemo(() => {
    return questTileEntity?.capacity === questTileEntity?.participant_count;
  }, [questTileEntity]);

  const rewardAmount = questTileEntity?.amount ?? 0;

  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(explorerEntityId)]));

  const remainingCapacity = useMemo(() => getRemainingCapacityInKg(resources!), [resources]);

  const explorerHasEnoughCapacity = useMemo(() => {
    return remainingCapacity >= Number(rewardAmount) / 10 ** 9;
  }, [remainingCapacity, rewardAmount]);

  return (
    <div className="flex flex-col gap-6 px-6 mx-auto max-w-full overflow-hidden h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        <div className="flex flex-col gap-5 text-xl p-4 border panel-wood rounded-lg backdrop-blur-sm h-full overflow-hidden">
          <div className="flex flex-row items-center gap-5 h-[40px]">
            <h2>Quest</h2>
            <div className="flex flex-row gap-2">Level: {(questTileEntity?.level ?? 0) + 1}</div>
          </div>
          <div className="flex flex-row justify-between items-center px-5 pt-5 h-1/4 border-t border-gold/20">
            <div className="flex flex-col items-center gap-2">
              <span>Reward</span>
              <span className="flex flex-row gap-2 items-center text-2xl font-bold text-gold">
                {divideByPrecision(Number(rewardAmount))}
                <ResourceIcon resource={ResourcesIds[questTileEntity?.resource_type ?? 1]} size={"sm"} />
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span>Target</span>
              <span className="text-2xl font-bold text-gold">{questLevel?.value?.target_score?.value} XP</span>
            </div>
            <div className="flex flex-col items-center gap-2 relative">
              <span>Participants</span>
              <span className="text-2xl font-bold text-gold">
                {questTileEntity?.participant_count} / {questTileEntity?.capacity}
              </span>
              {fullCapacity && (
                <span className="absolute -bottom-8 text-sm bg-gold/20 border border-gold rounded-lg px-2">
                  AT CAPACITY
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span>Time Limit</span>
              <span className="text-2xl font-bold text-gold">{formatTime(timeLimit)}</span>
            </div>
            {/* Start Quest Button */}
          </div>
          <div className="flex flex-row items-center justify-between h-[50px] w-full">
            <div className="flex flex-row items-center gap-2">
              <span className="text-lg font-bold">Available Quests</span>
              <Button variant="secondary" className="rounded-lg" onClick={() => refetchQuestGames()}>
                Refresh
              </Button>
            </div>
            {!explorerHasEnoughCapacity && (
              <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
                <div className="flex">
                  <span className="w-5">⚠️</span>
                  <span>Too heavy to claim reward</span>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 overflow-y-auto h-5/6 pr-2">
            {realmsOrVillages.map((structure) => {
              return (
                <QuestRealm
                  handleStartQuest={handleStartQuest}
                  loading={loading}
                  setLoading={setLoading}
                  questLevelInfo={questLevel}
                  structureInfo={structure}
                  armyInfo={armyInfo!}
                  questEntities={questEntities}
                  questGames={questGames}
                  fullCapacity={fullCapacity}
                  loadingQuests={loadingQuests}
                  explorerHasEnoughCapacity={explorerHasEnoughCapacity}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-5 text-xl p-4 border panel-wood  rounded-lg backdrop-blur-sm ">
          <div className="flex flex-row items-center gap-5 h-[40px]">
            <h2>Game Details</h2>
          </div>
          <img src={gameImage} alt="Dark Shuffle" className="w-full h-auto rounded pt-5 border-t border-gold/20" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-row justify-between">
              <div className="flex flex-col items-center">
                <span className="font-bold">Game</span> <span>Dark Shuffle</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold">Publisher</span> <span>Provable Games</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold">Url</span>
                <a href="https://darkshuffle.io" target="_blank" rel="noopener noreferrer">
                  darkshuffle.io
                </a>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold">Description</span>{" "}
              <span className="text-sm">{minigames?.[0]?.description}</span>
            </div>
          </div>
          <div className="flex flex-row gap-5 pt-5 border-t border-gold/20 overflow-x-auto overflow-y-hidden no-scrollbar">
            {questLevels.map((level: any, i: number) => {
              const timeLimit = level?.value?.time_limit?.value;
              const targetScore = level?.value?.target_score?.value;
              const settingsId = level?.value?.settings_id?.value;
              const settingName = settingsMetadata
                ?.find((setting) => setting.settings_id === settingsId)
                ?.name.split("Eternum Quest -")[1];
              return (
                <div className="flex flex-col gap-2 items-center justify-center border border-gold rounded-lg p-1 h-[90px] w-[200px] flex-shrink-0">
                  <div className="flex flex-row items-center justify-between text-sm w-full px-5">
                    <span className="font-bold text-sm">Level {i + 1}</span>
                    <div
                      className="flex flex-row items-center gap-2 text-[12px] relative group"
                      onClick={() =>
                        window.open(
                          `https://darkshuffle.dev/settings/${Number(level?.value?.settings_id?.value)}`,
                          "_blank",
                        )
                      }
                    >
                      <span className="font-bold">{settingName}</span>
                      <span className="text-[10px] text-gold">View</span>
                      <div className="absolute -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown border border-gold rounded-lg w-max group-hover:flex px-2">
                        <div className="flex flex-row items-center gap-1">
                          <span className="text-sm">See Settings</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row gap-2 border border-gold/20 bg-gold/10 px-2 w-full">
                    <div className="flex flex-col items-center text-sm w-1/3 relative group">
                      <span>Reward</span>
                      <div className="flex flex-row items-center gap-2">
                        <img src={BuildingThumbs.resources} className="w-4 h-4 self-center" />
                        <span className="text-[10px]">+{formatAmount((i + 1) * 7500)}</span>
                      </div>
                      <div className="absolute -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown border border-gold rounded-lg w-max group-hover:flex px-2">
                        <div className="flex flex-row items-center gap-1">
                          <img src={BuildingThumbs.resources} className="w-4 h-4 self-center" />
                          <span className="text-sm">+{formatAmount((i + 1) * 7500)} Random Resource</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-sm w-1/3">
                      <span>Target</span>
                      <span className="text-[10px]">{targetScore} XP</span>
                    </div>
                    <div className="flex flex-col items-center text-sm w-1/3">
                      <span>Time</span>
                      <span className="text-[10px]">{formatTime(timeLimit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
