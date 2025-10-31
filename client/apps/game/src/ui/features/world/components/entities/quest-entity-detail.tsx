import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { sqlApi } from "@/services/api";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { QuestTileData } from "@bibliothecadao/torii";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";
import { QuestReward } from "@/ui/features/economy/resources";

interface QuestEntityDetailProps {
  questEntityId: ID;
  compact?: boolean;
  className?: string;
  layout?: "default" | "banner";
}

export const QuestEntityDetail = ({ questEntityId, compact = false, className, layout = "default" }: QuestEntityDetailProps) => {
  const {
    setup: { components },
  } = useDojo();

  const [quest, setQuest] = useState<QuestTileData | undefined>(undefined);

  const isBanner = layout === "banner";

  useEffect(() => {
    const fetchQuest = async () => {
      const result = await sqlApi.fetchQuest(questEntityId);
      if (result) {
        setQuest(result);
      }
    };
    fetchQuest();
  }, [questEntityId]);

  const minigames = useMinigameStore((state) => state.minigames);
  const game = useMemo(
    () => minigames?.find((miniGame) => miniGame.contract_address === addAddressPadding(quest?.game_address || 0n)),
    [minigames, quest?.game_address],
  );
  const slotsRemaining = useMemo(
    () => (quest?.capacity ?? 0) - (quest?.participant_count ?? 0),
    [quest?.capacity, quest?.participant_count],
  );
  const hasSlotsRemaining = useMemo(() => slotsRemaining > 0, [slotsRemaining]);

  // Precompute common class strings for consistency with ArmyEntityDetail
  const smallTextClass = compact ? "text-xxs" : "text-xs";
  const panelClasses = (...extras: Array<string | false | undefined>) =>
    cn(
      "rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md",
      compact ? "px-3 py-2" : "px-4 py-3",
      ...extras,
    );

  const questLevelsEntity = useMemo(
    () => getComponentValue(components.QuestLevels, getEntityIdFromKeys([BigInt(quest?.game_address || 0)])),
    [components, quest?.game_address],
  );

  const questLevel = questLevelsEntity?.levels[quest?.level ?? 0] as any;

  const containerClasses = cn(
    "flex flex-col",
    compact ? "gap-1" : "gap-2",
    isBanner && "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-3 items-start",
    className,
  );
  const headerClasses = cn(
    "flex flex-wrap items-center justify-between gap-2 border-b border-gold/30 pb-2",
    isBanner && "md:col-span-2",
  );
  const descriptionClasses = cn("text-sm", isBanner && "md:col-span-2");
  const summaryRowClasses = cn(
    "flex flex-col gap-2",
    isBanner && "md:col-span-2 md:flex-row md:items-stretch md:gap-3",
  );

  if (!quest) return null;

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div className="flex flex-col">
          <h4 className={`${compact ? "text-base" : "text-lg"} font-bold`}>{game?.name}</h4>
          <span className="text-sm">Level {(quest?.level ?? 0) + 1}</span>
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-bold",
            hasSlotsRemaining
              ? "bg-ally/80 border border-ally text-lightest"
              : "bg-danger/80 border border-danger text-lightest",
          )}
        >
          {hasSlotsRemaining ? "Active" : "Ended"}
        </div>
      </div>

      <div className={descriptionClasses}>Interact with an explorer unit to start and claim quests.</div>

      <div className={summaryRowClasses}>
        <div className={panelClasses("flex-1 gap-2")}>
          <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Reward</div>
          <QuestReward quest={quest} />
        </div>
        <div className={panelClasses("flex-1 gap-2")}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-center text-sm">
            <span className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Remaining</span>
            <span className="text-sm text-right">{slotsRemaining}</span>
            <span className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Target</span>
            <span className="text-sm text-right">{questLevel?.value?.target_score?.value}XP</span>
            <span className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Time Limit</span>
            <span className="text-sm text-right">{formatTime(questLevel?.value?.time_limit?.value)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
