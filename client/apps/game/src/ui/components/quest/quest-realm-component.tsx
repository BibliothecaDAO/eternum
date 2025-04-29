import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { formatTime } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import { ArmyInfo, Structure } from "@bibliothecadao/types";
import { InfoIcon } from "lucide-react";
import { useMemo } from "react";

interface QuestRealmProps {
  handleStartQuest: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  questLevelInfo: any;
  structureInfo: Structure;
  armyInfo: ArmyInfo;
  questEntities: any[];
  questGames: any[];
}

export const QuestRealm = ({
  handleStartQuest,
  loading,
  setLoading,
  questLevelInfo,
  structureInfo,
  armyInfo,
  questEntities,
  questGames,
}: QuestRealmProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { claim_reward },
    },
  } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const realmId = structureInfo.structure.metadata.realm_id;
  const questExplorerUsed = realmId === armyInfo?.structure?.metadata?.realm_id;
  const explorers = useExplorersByStructure({ structureEntityId: structureInfo.entityId });

  const questEntitiesWithExplorers = questEntities.filter((quest) =>
    explorers.some((explorer) => explorer.entityId === quest.explorer_id),
  );
  const quest = questEntitiesWithExplorers[0];
  const isCompleted = quest?.completed;
  console.log(structureInfo?.name, quest);
  const game = questGames.find((game) => game.token_id === quest?.game_token_id);

  const timeRemaining = game?.end - Number(BigInt(Date.now()) / BigInt(1000));
  console.log(timeRemaining, game?.end, Date.now());
  const expired = timeRemaining < 0;
  const reachedTargetScore = game?.score >= questLevelInfo?.value?.target_score?.value;
  const startedQuest = !!game;

  const startQuestButtonMessage = useMemo(() => {
    return "Start and Play!";
  }, []);

  const claimRewardButtonMessage = useMemo(() => {
    return "Claim!";
  }, []);

  console.log("game", game);

  const handleClaimReward = async () => {
    try {
      setLoading(true);
      await claim_reward({
        signer: account,
        game_token_id: game?.token_id,
        game_address: game?.contract_address as string,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-36 flex flex-col items-center gap-2 border panel-wood rounded-lg p-4 ${!questExplorerUsed ? "opacity-70 pointer-events-none grayscale-[50%]" : ""}`}
    >
      <div className="flex flex-row items-center justify-between w-full">
        <span className="font-semibold text-sm">{structureInfo?.name}</span>
        <div className="flex flex-row items-center gap-2">
          <div
            className={`px-2 py-1 rounded text-xxs font-bold ${(!expired && questExplorerUsed) || isCompleted ? "bg-green/20" : "bg-red/20"}`}
          >
            {isCompleted
              ? "Claimed"
              : startedQuest
                ? expired
                  ? "Expired"
                  : `${formatTime(timeRemaining)}`
                : questExplorerUsed
                  ? "Start Quest"
                  : "No Explorer Found"}
          </div>
          <div className="flex flex-row items-center gap-2">
            {/* <span className="text-xxs">Game Info</span> */}
            {!!quest && (
              <InfoIcon
                onMouseEnter={() => {
                  setTooltip({
                    content: (
                      <img
                        src={JSON.parse(game.metadata)?.image}
                        alt={`Game #${Number(game.token_id)}`}
                        className="w-60 h-auto rounded p-2"
                        loading="lazy"
                      />
                    ),
                    position: "right",
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="w-4 h-4"
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center mt-auto border-t border-gold/20 pt-2 w-full">
        {isCompleted ? (
          <div className="text-xs">
            Completed With Score: <span className="font-bold">{game?.score}XP</span>
          </div>
        ) : startedQuest ? (
          <div className="flex flex-row justify-between gap-2 w-full">
            <div className="flex flex-col items-center w-1/2">
              <div className={`text-xxs font-bold text-gold/90 uppercase`}>Current Score</div>
              <div className="flex flex-row items-center gap-2">
                <span className="text-sm">{game.score}XP</span>
                {!expired && (
                  <Button
                    variant="secondary"
                    className="rounded-lg text-[8px] font-bold h-10"
                    size="xs"
                    onClick={() => window.open(`https://darkshuffle.dev/play/${Number(game.token_id)}`, "_blank")}
                  >
                    Continue
                  </Button>
                )}
              </div>
            </div>
            <Button
              variant="primary"
              className={`px-6 py-3 rounded-lg font-bold transition-colors w-1/2 ${reachedTargetScore ? "animate-pulse" : ""}`}
              isLoading={loading}
              disabled={expired || !questExplorerUsed || !reachedTargetScore}
              onClick={handleClaimReward}
            >
              {claimRewardButtonMessage}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className={`px-6 py-3 rounded-lg font-bold transition-colors w-full`}
            isLoading={loading}
            disabled={!questExplorerUsed}
            onClick={handleStartQuest}
          >
            {startQuestButtonMessage}
          </Button>
        )}
      </div>
    </div>
  );
};
