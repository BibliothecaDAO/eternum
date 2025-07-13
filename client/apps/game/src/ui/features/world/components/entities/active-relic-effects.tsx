import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, formatTime } from "@bibliothecadao/eternum";
import { getRelicInfo, ID, ResourcesIds, TickIds } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";

interface ActiveRelicEffectsProps {
  relicEffects: ComponentValue<any>[];
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
        const resourceId = Number(effect.effect_resource_id);
        const endTick = Number(effect.effect_end_tick);

        // Skip invalid data
        if (isNaN(resourceId) || isNaN(endTick)) return null;

        const relicInfo = getRelicInfo(resourceId as ResourcesIds);
        if (!relicInfo) return null;

        // Calculate remaining ticks until effect ends
        const remainingTicks = Math.max(0, endTick - currentArmiesTick);

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
        };
      })
      .filter((effect): effect is NonNullable<typeof effect> => effect !== null);
  }, [relicEffects, currentArmiesTick, armiesTickTimeRemaining]);

  const smallTextClass = compact ? "text-xxs" : "text-xs";
  const headerTextClass = compact ? "text-xs" : "text-sm";

  if (activeEffects.length === 0) {
    return (
      <div className={`flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1 ${className}`}>
        <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Active Relic Effects</div>
        <div className="text-xs text-gold/60 italic p-2 text-center">No active relic effects</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1 ${className}`}>
      <div className={`${smallTextClass} text-gold/80 uppercase font-semibold flex items-center gap-1`}>
        <Sparkles className="h-3 w-3 text-purple-400" />
        Active Relic Effects
      </div>

      <div className="flex flex-wrap gap-2">
        {activeEffects.map((effect) => (
          <div
            key={`${entityId}-${effect.resourceId}`}
            className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded"
            title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
          >
            <ResourceIcon resource={ResourcesIds[effect.resourceId]} size="xs" withTooltip={false} />
            <Sparkles className="h-2 w-2 text-purple-400 animate-pulse" />
            <span className="text-purple-400 font-medium text-xs">{formatTime(effect.remainingSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
