import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatRelicBonusText, getRelicBonusSummary } from "@/ui/utils/relic-utils";
import { configManager, formatTime, relicsArmiesTicksLeft } from "@bibliothecadao/eternum";
import { getRelicInfo, ID, RelicEffectWithEndTick, ResourcesIds, TickIds } from "@bibliothecadao/types";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";

interface ActiveRelicEffectsProps {
  relicEffects: RelicEffectWithEndTick[];
  entityId: ID;
  compact?: boolean;
  className?: string;
}

export const ActiveRelicEffects = ({ relicEffects, entityId, compact = false, className }: ActiveRelicEffectsProps) => {
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();

  const activeEffects = useMemo(() => {
    if (!relicEffects || relicEffects.length === 0) return [];

    return relicEffects
      .map((effect) => {
        const resourceId = Number(effect.id);
        const endTick = Number(effect.endTick);

        // Skip invalid data
        if (isNaN(resourceId) || isNaN(endTick)) return null;

        const relicInfo = getRelicInfo(resourceId as ResourcesIds);
        if (!relicInfo) return null;

        // Calculate remaining ticks until effect ends
        // todo: check relic effect active
        const remainingTicks = relicsArmiesTicksLeft(endTick, currentArmiesTick);

        // Get tick interval for armies (relics use army ticks)
        const armyTickInterval = configManager.getTick(TickIds.Armies) || 1;

        // Calculate total remaining time: (full remaining ticks * tick duration) + time left in current tick
        // Only add current tick time remaining if there are remaining ticks
        const remainingSeconds = remainingTicks > 0 ? remainingTicks * armyTickInterval + armiesTickTimeRemaining : 0;

        // Only show effects that have time remaining
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

  const relicIds = useMemo(() => activeEffects.map((effect) => effect.resourceId as ResourcesIds), [activeEffects]);

  const relicBonusSummary = useMemo(() => getRelicBonusSummary(relicIds), [relicIds]);

  const summaryEntries = useMemo(() => {
    const entries: Array<{ label: string; value: string; relicName?: string }> = [];

    if (relicBonusSummary.damageBonusPercent > 0) {
      entries.push({
        label: "Damage Output",
        value: `+${relicBonusSummary.damageBonusPercent}%`,
        relicName: relicBonusSummary.damageRelic?.name,
      });
    }

    if (relicBonusSummary.damageReductionPercent > 0) {
      entries.push({
        label: "Damage Taken",
        value: `-${relicBonusSummary.damageReductionPercent}%`,
        relicName: relicBonusSummary.damageReductionRelic?.name,
      });
    }

    if (relicBonusSummary.staminaBonusPercent > 0) {
      entries.push({
        label: "Stamina Regen",
        value: `+${relicBonusSummary.staminaBonusPercent}%`,
        relicName: relicBonusSummary.staminaRelic?.name,
      });
    }

    return entries;
  }, [relicBonusSummary]);

  const smallTextClass = compact ? "text-xxs" : "text-xs";

  if (activeEffects.length === 0) {
    return (
      <div className={`flex flex-col gap-1 w-full mt-1 border-t border-gold/20 pt-1 ${className}`}>
        <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Active Relic Effects</div>
        <div className="text-xs text-gold/60 italic p-2 text-center">No active relic effects</div>
      </div>
    );
  }

  const summaryContainerClass = compact ? "flex flex-wrap gap-1.5 mt-1" : "grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2";

  const effectsContainerClass = compact
    ? "flex flex-wrap gap-1.5"
    : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2";

  return (
    <div className={`flex flex-col gap-1.5 w-full mt-1 border-t border-gold/20 pt-1 ${className}`}>
      <div className={`${smallTextClass} text-gold/80 uppercase font-semibold flex items-center gap-1`}>
        <Sparkles className="h-3 w-3 text-relic2" />
        Active Relic Effects
      </div>

      {summaryEntries.length > 0 && (
        <div className={summaryContainerClass}>
          {summaryEntries.map((entry) => (
            <div
              key={`${entry.label}-${entry.value}`}
              className={`rounded border border-relic-activated/30 bg-relic-activated/10 ${
                compact ? "px-2 py-1" : "p-2"
              }`}
            >
              <div className={`${compact ? "text-[10px]" : "text-xs"} text-gold/70 uppercase font-semibold`}>
                {entry.label}
              </div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-bold text-gold`}>{entry.value}</div>
              {!compact && entry.relicName && <div className="text-xxs text-gold/60 mt-0.5">{entry.relicName}</div>}
            </div>
          ))}
        </div>
      )}

      <div className={effectsContainerClass}>
        {activeEffects.map((effect) => (
          <div
            key={`${entityId}-${effect.resourceId}`}
            className={`border border-relic-activated/20 rounded bg-dark-brown/80 ${compact ? "px-2 py-1.5" : "p-3"}`}
            title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
          >
            <div className="flex items-start gap-2">
              <ResourceIcon
                resource={ResourcesIds[effect.resourceId]}
                size={compact ? "xs" : "sm"}
                withTooltip={false}
              />
              <div className="flex flex-col gap-0.5">
                <span className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold`}>
                  {effect.relicInfo.name}
                </span>
                <span className={`${compact ? "text-[10px]" : "text-xs"} text-gold/70`}>{effect.bonusText}</span>
                {!compact && <span className="text-xxs text-gold/60">{effect.relicInfo.effect}</span>}
              </div>
            </div>
            <div
              className={`${compact ? "text-[10px]" : "text-xs"} text-relic2 font-medium mt-1 flex items-center gap-1`}
            >
              <Sparkles className="h-3 w-3 text-relic2" />
              {formatTime(effect.remainingSeconds)} left
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
