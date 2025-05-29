import Button from "@/ui/elements/button";
import { getStructureName } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import { ArmyInfo, ClientComponents, Structure } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { GameScore } from "metagame-sdk";
import { useMemo } from "react";
import { QuestReward } from "../resources/quest-reward";
import { QuestCountdown } from "./quest-countdown";

interface QuestRealmProps {
  questLevelInfo: any;
  structureInfo: Structure;
  armyInfo: ArmyInfo;
  questEntities: (ComponentValue<ClientComponents["Quest"]["schema"]> | undefined)[];
  questGames: Record<string, GameScore> | undefined;
  fullCapacity: boolean;
  loadingQuests: boolean;
}

export const QuestRealm = ({
  questLevelInfo,
  structureInfo,
  armyInfo,
  questEntities,
  questGames,
  fullCapacity,
  loadingQuests,
}: QuestRealmProps) => {
  const structureEntityId = structureInfo.structure.entity_id;
  const questExplorerUsed = useMemo(
    () => structureEntityId === armyInfo?.structure?.entity_id,
    [structureEntityId, armyInfo],
  );
  const explorers = useExplorersByStructure({ structureEntityId: structureInfo.entityId });

  const questEntitiesWithExplorers = useMemo(
    () => questEntities.filter((quest) => explorers.some((explorer) => explorer.entityId === quest?.explorer_id)),
    [questEntities, explorers],
  );
  const quest = questEntitiesWithExplorers[0]; // there should only be one quest per realm / village
  const isCompleted = quest?.completed;
  const game = questGames?.[Number(quest?.game_token_id)];
  const gameOver = useMemo(() => game?.health !== undefined && game?.health <= 0, [game]);
  const endTimestamp = game?.end;
  const score = useMemo(() => game?.score ?? 0, [game]);

  const timeRemaining = useMemo(() => {
    if (!endTimestamp) return 0;
    return endTimestamp - Number(BigInt(Date.now()) / BigInt(1000));
  }, [endTimestamp]);

  const expired = timeRemaining < 0;
  const reachedTargetScore = score >= questLevelInfo?.value?.target_score?.value;
  const startedQuest = !!quest;

  const getBadgeClass = () => {
    if (isCompleted) return "bg-green/20";
    if (reachedTargetScore) return "bg-green/20";
    if (gameOver && score !== 0) return "bg-red/20";
    if (startedQuest) return expired ? "bg-red/20" : "bg-green/20";
    if (fullCapacity) return "bg-red/20";
    if (questExplorerUsed) return "bg-green/20";
    return "bg-red/20";
  };

  const questStatus = useMemo(() => {
    if (isCompleted) return "Claimed";
    if (reachedTargetScore) return "Completed";
    if (gameOver && score !== 0) return "Failed";
    if (startedQuest) return expired ? "Expired" : <QuestCountdown endTimestamp={endTimestamp ?? 0} />;
    if (fullCapacity) return "Full Capacity";
    if (questExplorerUsed) return "Not Started";
    return "Explorer Not Found";
  }, [isCompleted, reachedTargetScore, gameOver, startedQuest, expired, fullCapacity]);

  return (
    <div
      className={`h-full flex flex-col items-center gap-2 border panel-wood rounded-lg p-4 ${!questExplorerUsed ? "opacity-70 pointer-events-none grayscale-[50%]" : ""}`}
    >
      {!loadingQuests ? (
        <>
          <div className="flex flex-row items-center justify-between w-full">
            <span className="font-semibold text-sm">{getStructureName(structureInfo.structure).name}</span>
            <div className="flex flex-row items-center gap-2">
              <div className={`px-2 py-1 rounded text-xxs font-bold ${getBadgeClass()}`}>{questStatus}</div>
            </div>
          </div>
          <div className="flex flex-row items-center mt-auto border-t border-gold/20 pt-2 w-full">
            {startedQuest ? (
              <div className="flex flex-row items-center justify-center gap-2 w-full">
                <div className={`text-sm font-bold text-gold/50 uppercase`}>Score</div>
                <span>{score}XP</span>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                <span>Not Started</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <img src="/images/logos/eternum-loader.png" className="w-[50px] h-[50px]" />
        </div>
      )}
    </div>
  );
};

interface CurrentQuestProps {
  handleStartQuest: () => Promise<number | undefined>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  questLevelInfo: any;
  structureInfo: Structure;
  armyInfo: ArmyInfo;
  quest: ComponentValue<ClientComponents["Quest"]["schema"]> | undefined;
  game: GameScore | null;
  fullCapacity: boolean;
  loadingQuests: boolean;
  explorerHasEnoughCapacity: boolean;
  realmExplorerStartedQuest?: boolean;
  gameAddress: string;
  questTile: ComponentValue<ClientComponents["QuestTile"]["schema"]> | undefined;
}

export const CurrentQuest = ({
  handleStartQuest,
  loading,
  setLoading,
  questLevelInfo,
  structureInfo,
  armyInfo,
  quest,
  game,
  fullCapacity,
  loadingQuests,
  explorerHasEnoughCapacity,
  realmExplorerStartedQuest,
  gameAddress,
  questTile,
}: CurrentQuestProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { claim_reward },
    },
  } = useDojo();
  const structureEntityId = structureInfo.structure.entity_id;
  const questExplorerUsed = structureEntityId === armyInfo?.structure?.entity_id;
  const targetScore = questLevelInfo?.value?.target_score?.value;

  const isCompleted = quest?.completed;

  const endTimestamp = game?.end;
  const gameOver = useMemo(() => game?.health !== undefined && game?.health <= 0, [game]);
  const score = useMemo(() => game?.score ?? 0, [game]);

  const timeRemaining = useMemo(() => {
    if (!endTimestamp) return 0;
    return endTimestamp - Number(BigInt(Date.now()) / BigInt(1000));
  }, [endTimestamp]);

  const questStates = useMemo(() => {
    const expired = timeRemaining < 0;
    const reachedTargetScore = score >= targetScore;
    const startedQuest = !!quest;

    return { expired, reachedTargetScore, startedQuest };
  }, [timeRemaining, score, targetScore, quest]);

  const { expired, reachedTargetScore, startedQuest } = questStates;

  const questStatus = useMemo(() => {
    if (isCompleted) return "Reward Claimed";
    if (reachedTargetScore) return "Completed";
    if (gameOver && score !== 0) return "Failed";
    if (startedQuest) return expired ? "Expired" : "Active";
    if (questExplorerUsed) {
      if (!fullCapacity) {
        return realmExplorerStartedQuest ? "Quest Started With Another Explorer" : "Not Started";
      }
      return "Full Capacity";
    }
    return "Explorer Not Found";
  }, [questStates, questExplorerUsed, fullCapacity, realmExplorerStartedQuest]);

  const getBadgeClass = () => {
    if (isCompleted) return "bg-green/20";
    if (reachedTargetScore) return "bg-green/20";
    if (gameOver && score !== 0) return "bg-red/20";
    if (startedQuest) return expired ? "bg-red/20" : "bg-green/20";
    if (questExplorerUsed) {
      if (!fullCapacity) {
        return realmExplorerStartedQuest ? "bg-red/20" : "bg-green/20";
      }
      return "bg-red/20";
    }
    return "bg-red/20";
  };

  const startQuestButtonMessage = useMemo(() => {
    return "Start and Play!";
  }, []);

  const claimRewardButtonMessage = useMemo(() => {
    return "Claim!";
  }, []);

  const handleClaimReward = async () => {
    try {
      setLoading(true);
      await claim_reward({
        signer: account,
        game_token_id: game?.token_id ?? 0,
        game_address: gameAddress,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!questTile) return null;

  return (
    <div
      className={`h-full flex flex-col items-center gap-2 p-4 ${!questExplorerUsed ? "opacity-70 pointer-events-none grayscale-[50%]" : ""}`}
    >
      {!loadingQuests ? (
        <>
          {questStatus !== "Not Started" &&
            (questStatus === "Quest Started With Another Explorer" ? (
              <div className={`px-2 py-1 rounded text-xxs font-bold ${getBadgeClass()}`}>{questStatus}</div>
            ) : (
              <div className="flex flex-row items-center justify-between w-full pb-5 h-12">
                <div className="flex flex-row items-center gap-2">
                  <div className={`text-sm font-bold text-gold/50 uppercase`}>Score</div>
                  <span>{score}XP</span>
                </div>

                <div className="flex flex-row items-center gap-2">
                  {startedQuest && !expired && !reachedTargetScore && !gameOver && (
                    <div>
                      <QuestCountdown endTimestamp={endTimestamp ?? 0} />
                    </div>
                  )}
                  {!explorerHasEnoughCapacity && startedQuest && reachedTargetScore && !isCompleted && (
                    <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
                      <div className="flex">
                        <span className="w-5">⚠️</span>
                        <span>Too heavy to claim reward</span>
                      </div>
                    </div>
                  )}
                  {isCompleted && (
                    <div className="flex flex-row items-center gap-1 text-green border border-green/20 bg-green/10 rounded-lg p-1">
                      <span>+</span>
                      <QuestReward quest={questTile} />
                    </div>
                  )}
                  <div className={`px-2 py-1 rounded text-xxs font-bold ${getBadgeClass()}`}>{questStatus}</div>
                </div>
              </div>
            ))}
          {isCompleted || expired || questStatus === "Quest Started With Another Explorer" ? (
            <></>
          ) : reachedTargetScore ? (
            <div className="flex flex-col items-center w-full h-full border-t border-gold/20 pt-5">
              <Button
                variant="primary"
                className={`px-6 py-3 rounded-lg font-bold transition-colors w-1/2 ${reachedTargetScore && explorerHasEnoughCapacity ? "animate-pulse" : ""}`}
                isLoading={loading}
                disabled={!questExplorerUsed || !reachedTargetScore || !explorerHasEnoughCapacity}
                onClick={handleClaimReward}
              >
                {claimRewardButtonMessage}
              </Button>
            </div>
          ) : !startedQuest ? (
            <Button
              variant="primary"
              className={`px-6 py-3 rounded-lg font-bold transition-colors w-1/2`}
              isLoading={loading}
              disabled={!questExplorerUsed || fullCapacity || realmExplorerStartedQuest}
              onClick={async () => {
                const gameId = await handleStartQuest();
                if (gameId) {
                  window.open(`https://darkshuffle.io/play/${Number(gameId)}`, "_blank");
                }
              }}
            >
              {startQuestButtonMessage}
            </Button>
          ) : (
            (!gameOver || score === 0) && (
              <div className="flex flex-col items-center w-full h-full border-t border-gold/20 pt-5">
                <Button
                  variant="primary"
                  className={`px-6 py-3 rounded-lg font-bold transition-colors w-1/2`}
                  isLoading={loading}
                  onClick={() => window.open(`https://darkshuffle.io/play/${Number(game?.token_id ?? 0)}`, "_blank")}
                >
                  Play
                </Button>
              </div>
            )
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <img src="/images/logos/eternum-loader.png" className="w-[50px] h-[50px]" />
        </div>
      )}
    </div>
  );
};
