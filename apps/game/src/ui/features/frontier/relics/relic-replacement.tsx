import { Icon } from "@/ui/design-system/icon";
import { HudRow } from "@/ui/design-system/kit/hud-elements";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { type PickEffectBase } from "../pick-effect-format";
import { relicMeaning } from "@/ui/design-system/domain-icon-meaning";
import { relicEffect, relicName, type ArmyRelic } from "./relic-catalog";

export const RelicPay = ({ relic, pickBase }: { relic: ArmyRelic; pickBase: PickEffectBase }) => (
  <span className="flex items-center gap-1.5" data-ruin-relic aria-label={RELIC_WORDS.guards(relicName(relic))}>
    <Icon name={relicMeaning(relic.kind)} size={20} />
    <span className="flex min-w-0 flex-col">
      <span className="text-hud-label text-hud-ink">{relicName(relic)}</span>
      <span data-relic-effect className="text-hud-label text-hud-muted">
        {relicEffect(relic, pickBase)}
      </span>
    </span>
  </span>
);

/**
 * Before a full army attacks a ruin, the relic its clear replaces: the army's three relics, one tap picks one. The
 * contract takes that slot with the attack and refuses an attack on a ruin without it while all three are taken.
 */
export const RelicReplacement = ({
  carried,
  chosen,
  pickBase,
  onChoose,
}: {
  carried: readonly [ArmyRelic, ArmyRelic, ArmyRelic];
  chosen: 0 | 1 | 2 | null;
  pickBase: PickEffectBase;
  onChoose: (slot: 0 | 1 | 2) => void;
}) => (
  <section className="flex flex-col gap-1" aria-label={RELIC_WORDS.full} data-relic-replacement>
    <p className="text-hud-label text-hud-ink">{RELIC_WORDS.full}</p>
    {carried.map((relic, index) => {
      const slot = index as 0 | 1 | 2;
      return (
        <HudRow
          key={slot}
          label={RELIC_WORDS.replace(relicName(relic))}
          lead={<Icon name={relicMeaning(relic.kind)} size={22} />}
          title={relicName(relic)}
          detail={relicEffect(relic, pickBase)}
          selected={chosen === slot}
          onClick={() => onChoose(slot)}
        />
      );
    })}
  </section>
);
