import "./army-relic-slots.css";

import type { RelicCollectOutcome } from "@bibliothecadao/eternum";
import { tierNumeral } from "@bibliothecadao/types";

import { relicMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { HudTier } from "@/ui/design-system/kit/hud-elements";
import { type Rank, RELIC_WORDS } from "@/ui/design-system/kit/words";

import { type PickEffectBase } from "../pick-effect-format";
import { relicEffect, relicName, type ArmyRelic } from "./relic-catalog";

export const RelicPay = ({ relic, pickBase }: { relic: ArmyRelic; pickBase: PickEffectBase }) => (
  <span className="flex items-center gap-1.5" data-ruin-relic aria-label={RELIC_WORDS.guards(relicName(relic))}>
    <Icon name={relicMeaning(relic.kind)} size={20} />
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1 text-hud-label text-hud-ink">
        <span>{relicName(relic)}</span>
        <HudTier tier={relic.rank as Rank} size="line" />
      </span>
      <span data-relic-effect className="text-hud-label text-hud-muted">
        {relicEffect(relic, pickBase)}
      </span>
    </span>
  </span>
);

export const RelicOutcomeNote = ({
  relic,
  outcome,
  previousRank,
  resultRank,
}: {
  relic: ArmyRelic;
  outcome: RelicCollectOutcome;
  previousRank: number;
  resultRank: number;
}) => {
  const line =
    outcome === "Collected"
      ? RELIC_WORDS.previewCollected(RELIC_WORDS.kinds[relic.kind])
      : outcome === "Merged"
        ? RELIC_WORDS.previewMerged(tierNumeral(previousRank as Rank), tierNumeral(resultRank as Rank))
        : outcome === "Replaced"
          ? RELIC_WORDS.previewReplaced(tierNumeral(previousRank as Rank), tierNumeral(resultRank as Rank))
          : RELIC_WORDS.previewDiscarded(tierNumeral(previousRank as Rank));
  return (
    <div className="relic-outcome-note" data-relic-outcome={outcome}>
      <Icon name={relicMeaning(relic.kind)} size={16} />
      <span>{line}</span>
    </div>
  );
};
