import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatRelicBonusText } from "@/ui/utils/relic-utils";
import { configManager, formatTime, relicsArmiesTicksLeft } from "@bibliothecadao/eternum";
import { getRelicInfo, ID, RelicEffectWithEndTick, RelicInfo, ResourcesIds, TickIds } from "@bibliothecadao/types";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useMemo } from "react";

interface ActiveRelicEffectsProps {
  relicEffects: RelicEffectWithEndTick[];
  entityId: ID;
  compact?: boolean;
  className?: string;
}

const RELIC_TYPE_BORDER: Record<RelicInfo["type"], string> = {
  Stamina: "border-relics-stamina-text/30",
  Damage: "border-relics-damage-text/30",
  "Damage Reduction": "border-relics-damageReduction-text/30",
  Exploration: "border-relics-exploration-text/30",
  Production: "border-relics-production-text/30",
};

const RELIC_TYPE_BG: Record<RelicInfo["type"], string> = {
  Stamina: "bg-relics-stamina-bg",
  Damage: "bg-relics-damage-bg",
  "Damage Reduction": "bg-relics-damageReduction-bg",
  Exploration: "bg-relics-exploration-bg",
  Production: "bg-relics-production-bg",
};

const RELIC_TYPE_TEXT: Record<RelicInfo["type"], string> = {
  Stamina: "text-relics-stamina-text",
  Damage: "text-relics-damage-text",
  "Damage Reduction": "text-relics-damageReduction-text",
  Exploration: "text-relics-exploration-text",
  Production: "text-relics-production-text",
};

const getTimerUrgency = (remainingSeconds: number): string => {
  if (remainingSeconds < 300) return "text-relics-damage-text";
  if (remainingSeconds < 3600) return "text-yellow-400";
  return "text-relics-stamina-text";
};

export const ActiveRelicEffects = ({ relicEffects, entityId, compact = false, className }: ActiveRelicEffectsProps) => {
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();

  const activeEffects = useMemo(() => {
    if (!relicEffects || relicEffects.length === 0) return [];

    return relicEffects
      .map((effect) => {
        const resourceId = Number(effect.id);
        const endTick = Number(effect.endTick);

        if (isNaN(resourceId) || isNaN(endTick)) return null;

        const relicInfo = getRelicInfo(resourceId as ResourcesIds);
        if (!relicInfo) return null;

        const remainingTicks = relicsArmiesTicksLeft(endTick, currentArmiesTick);
        const armyTickInterval = configManager.getTick(TickIds.Armies) || 1;
        const remainingSeconds = remainingTicks > 0 ? remainingTicks * armyTickInterval + armiesTickTimeRemaining : 0;

        if (remainingSeconds <= 0) return null;

        return {
          relicInfo,
          remainingSeconds,
          resourceId,
          bonusText: formatRelicBonusText(relicInfo),
        };
      })
      .filter((effect): effect is NonNullable<typeof effect> => effect !== null);
  }, [relicEffects, currentArmiesTick, armiesTickTimeRemaining]);

  if (activeEffects.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex flex-col gap-1.5 w-full mt-1 border-t border-gold/20 pt-1.5 ${className ?? ""}`}>
        <div className="text-xxs text-gold/80 uppercase font-semibold flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-relic2 animate-pulse" />
          Active Relic Effects
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeEffects.map((effect) => {
            const type = effect.relicInfo.type;
            const border = RELIC_TYPE_BORDER[type] ?? "border-gold/20";
            const bg = RELIC_TYPE_BG[type] ?? "bg-dark-brown/80";
            const text = RELIC_TYPE_TEXT[type] ?? "text-gold";
            const timerColor = getTimerUrgency(effect.remainingSeconds);

            return (
              <div
                key={`${entityId}-${effect.resourceId}`}
                className={`flex items-center gap-1.5 rounded border ${border} ${bg} px-2 py-1`}
                title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
              >
                <ResourceIcon resource={ResourcesIds[effect.resourceId]} size="xs" withTooltip={false} />
                <span className={`text-[11px] font-semibold ${text}`}>{effect.bonusText}</span>
                <span className={`text-[10px] font-medium ${timerColor}`}>{formatTime(effect.remainingSeconds)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 w-full mt-1 border-t border-gold/20 pt-2 ${className ?? ""}`}>
      <div className="text-xs text-gold/80 uppercase font-semibold flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-relic2 animate-pulse" />
        Active Relic Effects
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {activeEffects.map((effect) => {
          const type = effect.relicInfo.type;
          const border = RELIC_TYPE_BORDER[type] ?? "border-gold/20";
          const bg = RELIC_TYPE_BG[type] ?? "bg-dark-brown/80";
          const text = RELIC_TYPE_TEXT[type] ?? "text-gold";
          const timerColor = getTimerUrgency(effect.remainingSeconds);

          return (
            <div
              key={`${entityId}-${effect.resourceId}`}
              className={`border ${border} rounded ${bg} p-3`}
              title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
            >
              <div className="flex items-start gap-2">
                <ResourceIcon resource={ResourcesIds[effect.resourceId]} size="sm" withTooltip={false} />
                <div className="flex flex-col gap-0.5">
                  <span className={`text-sm font-semibold ${text}`}>{effect.relicInfo.name}</span>
                  <span className="text-xs text-gold/70">{effect.bonusText}</span>
                  <span className="text-xxs text-gold/60">{effect.relicInfo.effect}</span>
                </div>
              </div>
              <div className={`text-xs ${timerColor} font-medium mt-1.5 flex items-center gap-1`}>
                <Sparkles className="h-3 w-3" />
                {formatTime(effect.remainingSeconds)} left
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
