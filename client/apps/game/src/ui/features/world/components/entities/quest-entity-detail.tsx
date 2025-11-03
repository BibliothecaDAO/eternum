import { useEffect, useMemo, useState } from "react";

import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { sqlApi } from "@/services/api";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { QuestReward } from "@/ui/features/economy/resources";
import { formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { QuestTileData } from "@bibliothecadao/torii";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { addAddressPadding } from "starknet";

import {
  EntityDetailLayoutVariant,
  EntityDetailSection,
  EntityDetailStat,
  EntityDetailStatList,
  getLayoutTextClasses,
} from "./layout";

interface QuestEntityDetailProps {
  questEntityId: ID;
  compact?: boolean;
  className?: string;
  layout?: "default" | "banner";
  layoutVariant?: EntityDetailLayoutVariant;
}

interface QuestEntityDetailContentProps extends Omit<QuestEntityDetailProps, "layoutVariant" | "layout"> {
  variant: EntityDetailLayoutVariant;
}

const QuestEntityDetailContent = ({ questEntityId, className, compact = false, variant }: QuestEntityDetailContentProps) => {
  const {
    setup: { components },
  } = useDojo();

  const [quest, setQuest] = useState<QuestTileData | undefined>(undefined);
  const isBanner = variant === "banner";
  const isCompactLayout = compact;

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
  const slotsRemaining = useMemo(() => (quest?.capacity ?? 0) - (quest?.participant_count ?? 0), [quest?.capacity, quest?.participant_count]);
  const hasSlotsRemaining = useMemo(() => slotsRemaining > 0, [slotsRemaining]);

  const questLevelsEntity = useMemo(
    () => getComponentValue(components.QuestLevels, getEntityIdFromKeys([BigInt(quest?.game_address || 0)])),
    [components, quest?.game_address],
  );

  const questLevel = questLevelsEntity?.levels[quest?.level ?? 0] as any;

  if (!quest) return null;

  const containerClasses = cn(
    "flex flex-col",
    isCompactLayout ? "gap-1.5" : "gap-2",
    isBanner && "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-3 items-start",
    className,
  );

  const labelClass = cn(
    "font-semibold uppercase tracking-[0.2em] text-gold/70",
    getLayoutTextClasses(isCompactLayout, "title"),
  );
  const bodyClass = cn("text-gold/70", getLayoutTextClasses(isCompactLayout, "body"));

  const statusLabel = hasSlotsRemaining ? (isBanner ? "Active" : "Slots Open") : isBanner ? "Full" : "Ended";
  const statusTone = hasSlotsRemaining ? "bg-ally/80 border border-ally text-lightest" : "bg-danger/80 border border-danger text-lightest";
  const questDescription = isBanner
    ? "Interact with an explorer to start."
    : "Interact with an explorer unit to start and claim quests.";

  return (
    <div className={containerClasses}>
      <EntityDetailSection compact={compact} className={isBanner ? "md:col-span-2" : undefined}>
        <div className={cn(labelClass, "mb-1")}>{game?.name}</div>
        <div className={cn(bodyClass, "mb-2")}>{`${isBanner ? "Lvl" : "Level"} ${(quest?.level ?? 0) + 1}`}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gold/70">{questDescription}</span>
          <div className={cn("rounded px-2 py-1 text-xs font-bold", statusTone)}>{statusLabel}</div>
        </div>
      </EntityDetailSection>

      <EntityDetailSection compact={compact} className={isBanner ? "md:col-span-2" : undefined}>
        <div className={cn(labelClass, "mb-2")}>Reward</div>
        <QuestReward quest={quest} />
      </EntityDetailSection>

      <EntityDetailSection compact={compact} className={isBanner ? "md:col-span-2" : undefined}>
        <div className={cn(labelClass, "mb-2")}>{isBanner ? "Details" : "Quest Requirements"}</div>
        <EntityDetailStatList compact={compact} columns={isBanner ? 3 : 1}>
          <EntityDetailStat compact={compact} label="Slots" value={slotsRemaining} emphasizeValue={!hasSlotsRemaining} />
          <EntityDetailStat compact={compact} label="Target" value={`${questLevel?.value?.target_score?.value ?? 0} XP`} />
          <EntityDetailStat compact={compact} label="Time" value={formatTime(questLevel?.value?.time_limit?.value)} />
        </EntityDetailStatList>
      </EntityDetailSection>
    </div>
  );
};

export const QuestEntityDetail = ({
  questEntityId,
  compact = false,
  className,
  layout = "default",
  layoutVariant,
}: QuestEntityDetailProps) => {
  const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (layout === "banner" ? "banner" : "default");

  return (
    <QuestEntityDetailContent
      questEntityId={questEntityId}
      className={className}
      compact={compact}
      variant={resolvedVariant}
    />
  );
};
