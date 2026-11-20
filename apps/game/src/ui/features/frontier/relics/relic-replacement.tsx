import { Icon } from "@/ui/design-system/icon";
import { HudRarity, HudRow } from "@/ui/design-system/kit/hud-elements";
import { RELIC_WORDS, type Tier } from "@/ui/design-system/kit/words";

import { relicEffect, relicIcon, relicName, type ArmyRelic } from "./relic-catalog";

/** A ruin's relic in what its clear pays: its painting, its tier's rarity and its name. */
export const RelicPay = ({ relic }: { relic: ArmyRelic }) => (
  <span className="flex items-center gap-2" data-ruin-relic aria-label={RELIC_WORDS.guards(relicName(relic))}>
    <Icon name={relicIcon(relic.kind)} size={22} />
    <span className="text-hud-body text-hud-ink">{relicName(relic)}</span>
    <HudRarity tier={relic.rank as Tier} />
  </span>
);

/**
 * Before a full army attacks a ruin, the relic its clear replaces: the army's three relics, one tap picks one. The
 * contract takes that slot with the attack and refuses an attack on a ruin without it while all three are taken.
 */
export const RelicReplacement = ({
  carried,
  chosen,
  onChoose,
}: {
  carried: readonly [ArmyRelic, ArmyRelic, ArmyRelic];
  chosen: 0 | 1 | 2 | null;
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
          lead={<Icon name={relicIcon(relic.kind)} size={22} />}
          title={relicName(relic)}
          detail={relicEffect(relic)}
          selected={chosen === slot}
          onClick={() => onChoose(slot)}
        />
      );
    })}
  </section>
);
