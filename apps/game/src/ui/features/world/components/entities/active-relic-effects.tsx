import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatRelicBonusText } from "@/ui/utils/relic-utils";
import { bonusActive, formatTime } from "@bibliothecadao/eternum";
import { getRelicInfo, ID, RelicEffect, RelicInfo, ResourcesIds } from "@bibliothecadao/types";

import { useMemo } from "react";

interface ActiveRelicEffectsProps {
  relicEffects: RelicEffect[];
  entityId: ID;
  compact?: boolean;
  className?: string;
  variant?: "default" | "inline";
  maxItems?: number;
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
  if (remainingSeconds < 3600) return "text-hud-warn";
  return "text-relics-stamina-text";
};

export const ActiveRelicEffects = ({
  relicEffects,
  entityId,
  compact = false,
  className,
  variant = "default",
  maxItems,
}: ActiveRelicEffectsProps) => {
  const now = useCurrentDefaultTick();

  const activeEffects = useMemo(() => {
    if (!relicEffects || relicEffects.length === 0) return [];

    return relicEffects
      .map((effect) => {
        const resourceId = Number(effect.id);

        if (isNaN(resourceId) || isNaN(effect.endAt)) return null;

        const relicInfo = getRelicInfo(resourceId as ResourcesIds);
        if (!relicInfo) return null;

        const remainingSeconds = effect.endAt - now;

        if (!bonusActive(effect.endAt, now)) return null;

        return {
          relicInfo,
          remainingSeconds,
          resourceId,
          bonusText: formatRelicBonusText(relicInfo),
        };
      })
      .filter((effect): effect is NonNullable<typeof effect> => effect !== null);
  }, [relicEffects, now]);

  if (activeEffects.length === 0) {
    return null;
  }

  if (variant === "inline") {
    const visibleEffects = maxItems ? activeEffects.slice(0, maxItems) : activeEffects;
    const hiddenEffectsCount = Math.max(activeEffects.length - visibleEffects.length, 0);

    return (
      <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
        {visibleEffects.map((effect) => {
          const type = effect.relicInfo.type;
          const border = RELIC_TYPE_BORDER[type] ?? "border-hud-divider";
          const bg = RELIC_TYPE_BG[type] ?? "bg-dark-brown/80";
          const text = RELIC_TYPE_TEXT[type] ?? "text-hud-ink";
          const timerColor = getTimerUrgency(effect.remainingSeconds);

          return (
            <div
              key={`${entityId}-${effect.resourceId}`}
              className={`flex max-w-full items-center gap-1.5 rounded border ${border} ${bg} px-2 py-1`}
              title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
            >
              <ResourceIcon resource={effect.resourceId} size="md" withTooltip={false} />
              <span className={`truncate text-hud-strong ${text}`}>{effect.bonusText}</span>
              <span className={`shrink-0 text-hud-label ${timerColor}`}>{formatTime(effect.remainingSeconds)}</span>
            </div>
          );
        })}
        {hiddenEffectsCount > 0 ? (
          <div
            className="flex items-center rounded border border-hud-line bg-hud-well px-2 py-1 text-hud-label text-hud-muted"
            title={`${hiddenEffectsCount} more active relic effect${hiddenEffectsCount === 1 ? "" : "s"}`}
          >
            +{hiddenEffectsCount}
          </div>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-col gap-1.5 w-full mt-1 border-t border-hud-divider pt-1.5 ${className ?? ""}`}>
        <div className="text-hud-label text-hud-ink uppercase flex items-center gap-1">
          <SemanticIcon name="relics" className="h-3 w-3 text-relic2 animate-pulse" />
          Active Relic Effects
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeEffects.map((effect) => {
            const type = effect.relicInfo.type;
            const border = RELIC_TYPE_BORDER[type] ?? "border-hud-divider";
            const bg = RELIC_TYPE_BG[type] ?? "bg-dark-brown/80";
            const text = RELIC_TYPE_TEXT[type] ?? "text-hud-ink";
            const timerColor = getTimerUrgency(effect.remainingSeconds);

            return (
              <div
                key={`${entityId}-${effect.resourceId}`}
                className={`flex items-center gap-1.5 rounded border ${border} ${bg} px-2 py-1`}
                title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
              >
                <ResourceIcon resource={effect.resourceId} size="md" withTooltip={false} />
                <span className={`text-hud-strong ${text}`}>{effect.bonusText}</span>
                <span className={`text-hud-label ${timerColor}`}>{formatTime(effect.remainingSeconds)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 w-full mt-1 border-t border-hud-divider pt-2 ${className ?? ""}`}>
      <div className="text-hud-label text-hud-ink uppercase flex items-center gap-1">
        <SemanticIcon name="relics" className="h-3 w-3 text-relic2 animate-pulse" />
        Active Relic Effects
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {activeEffects.map((effect) => {
          const type = effect.relicInfo.type;
          const border = RELIC_TYPE_BORDER[type] ?? "border-hud-divider";
          const bg = RELIC_TYPE_BG[type] ?? "bg-dark-brown/80";
          const text = RELIC_TYPE_TEXT[type] ?? "text-hud-ink";
          const timerColor = getTimerUrgency(effect.remainingSeconds);

          return (
            <div
              key={`${entityId}-${effect.resourceId}`}
              className={`border ${border} rounded ${bg} p-3`}
              title={`${effect.relicInfo.name}: ${effect.relicInfo.effect}`}
            >
              <div className="flex items-start gap-2">
                <ResourceIcon resource={effect.resourceId} size="sm" withTooltip={false} />
                <div className="flex flex-col gap-0.5">
                  <span className={`text-hud-strong ${text}`}>{effect.relicInfo.name}</span>
                  <span className="text-hud-label text-hud-muted">{effect.bonusText}</span>
                  <span className="text-hud-label text-hud-muted">{effect.relicInfo.effect}</span>
                </div>
              </div>
              <div className={`text-hud-label ${timerColor} mt-1.5 flex items-center gap-1`}>
                <SemanticIcon name="relics" className="h-3 w-3" />
                {formatTime(effect.remainingSeconds)} left
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
