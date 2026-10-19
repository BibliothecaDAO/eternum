import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudRelic } from "@/ui/design-system/kit/hud-elements";
import { RELIC_KIND } from "./relic-kind";
import { relicShortName } from "@/ui/design-system/kit/words";
import { bonusActive } from "@bibliothecadao/eternum";
import { getRelicInfo, ID, RelicEffect, ResourcesIds, formatWait } from "@bibliothecadao/types";

import { useMemo } from "react";

interface ActiveRelicEffectsProps {
  relicEffects: RelicEffect[];
  entityId: ID;
}

/** How short a relic's time runs: under five minutes it is about to go, under an hour it is going. */
const timeLeftTone = (remainingSeconds: number) =>
  remainingSeconds < 300 ? "bad" : remainingSeconds < 3600 ? "warn" : "good";

/**
 * The relics working on a structure or an army: each its painting and its name in its kind's colour, as the held chip
 * names it, and how long it still works, in a tone as it runs short; what it does on hover. Gone the moment its time
 * ends.
 */
export const ActiveRelicEffects = ({ relicEffects, entityId }: ActiveRelicEffectsProps) => {
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
        };
      })
      .filter((effect): effect is NonNullable<typeof effect> => effect !== null);
  }, [relicEffects, now]);

  if (activeEffects.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-1 text-hud-label text-hud-muted">
        <SemanticIcon name="relics" className="h-3 w-3" />
        Active relic effects
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeEffects.map((effect) => (
          <HudRelic
            key={`${entityId}-${effect.resourceId}`}
            icon={resourceMeaning(effect.resourceId)}
            kind={RELIC_KIND[effect.relicInfo.type]}
            gives={relicShortName(effect.resourceId)}
            trail={`${formatWait(effect.remainingSeconds)} left`}
            trailTone={timeLeftTone(effect.remainingSeconds)}
            title={`${relicShortName(effect.resourceId)}: ${effect.relicInfo.effect}`}
          />
        ))}
      </div>
    </div>
  );
};
