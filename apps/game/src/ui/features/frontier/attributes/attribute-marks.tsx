import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudRarity } from "@/ui/design-system/kit/hud-elements";

import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { ATTRIBUTES, TIER_WORDS } from "@/ui/design-system/kit/words";

const MARKS: IconMeaning[] = ["order-rage", "order-skill", "order-detection", "order-enlightenment"];

/**
 * The four attributes as their Aspect marks with each tier's rarity pips under it, no words: where a row of four has no room
 * (the tiers a new army starts at, a training building's next army).
 */
export const AttributeMarks = ({ tiers }: { tiers: readonly [Tier, Tier, Tier, Tier] }) => (
  <span className="flex items-center gap-2">
    {ATTRIBUTES.map((attribute, index) => (
      <span
        key={attribute}
        role="img"
        aria-label={`${attribute} ${TIER_WORDS[tiers[index] - 1]}`}
        className="flex flex-col items-center gap-px"
      >
        <SemanticIcon name={MARKS[index]} size={22} />
        <HudRarity tier={tiers[index]} />
      </span>
    ))}
  </span>
);
