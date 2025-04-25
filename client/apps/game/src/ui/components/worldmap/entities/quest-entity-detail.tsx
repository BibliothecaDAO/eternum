import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { formatTime, getEntityIdFromKeys, getQuest, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { addAddressPadding } from "starknet";
import { QuestReward } from "../../resources/quest-reward";

interface QuestEntityDetailProps {
  questEntityId: ID;
  compact?: boolean;
  className?: string;
}

export const QuestEntityDetail = ({ questEntityId, compact = false, className }: QuestEntityDetailProps) => {
  const {
    account,
    setup: { components },
  } = useDojo();
  const quest = getQuest(questEntityId, components);
  const minigames = useMinigameStore((state) => state.minigames);
  const game = minigames?.find(
    (miniGame) => miniGame.contract_address === addAddressPadding(toHexString(quest.game_address)),
  );
  const slotsRemaining = quest.capacity - quest.participant_count;
  const hasSlotsRemaining = slotsRemaining > 0;

  // Precompute common class strings for consistency with ArmyEntityDetail
  const smallTextClass = compact ? "text-xxs" : "text-xs";

  const questLevelsEntity = getComponentValue(
    components.QuestLevels,
    getEntityIdFromKeys([BigInt(quest?.game_address || 0)]),
  );

  const questLevel = questLevelsEntity?.levels[quest?.level ?? 0] as any;

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
      {/* Header with game name and status */}
      <div className="flex items-center justify-between border-b border-gold/30 pb-2 gap-2">
        <div className="flex flex-col">
          <h4 className={`${compact ? "text-base" : "text-lg"} font-bold`}>{game?.name}</h4>
          <span className="text-sm">Level {quest.level}</span>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${hasSlotsRemaining ? "bg-green/20" : "bg-red/20"}`}>
          {hasSlotsRemaining ? "Active" : "Ended"}
        </div>
      </div>

      <div className="text-sm">Interact with an explorer unit to start and claim quests.</div>

      {/* Reward display */}
      <div className="flex flex-row justify-between mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
        <div className="flex flex-col">
          <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Reward</div>
          <QuestReward quest={quest} />
        </div>
        <div className="flex flex-col">
          <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Remaining</div>
          <span className="text-sm text-right">{slotsRemaining}</span>
        </div>
      </div>

      {/* Quest details */}
      <div className="flex flex-row justify-between mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
        <div className="flex flex-col">
          <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Target</div>
          <span className="text-sm">{questLevel?.value?.target_score?.value}XP</span>
        </div>
        <div className="flex flex-col">
          <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Time Limit</div>
          <span className="text-sm text-right">{formatTime(questLevel?.value?.time_limit?.value)}</span>
        </div>
      </div>
    </div>
  );
};
