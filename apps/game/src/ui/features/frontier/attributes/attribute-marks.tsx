import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { ATTRIBUTES, TIER_WORDS } from "@/ui/design-system/kit/words";

const MARKS: IconCode[] = ["Ba", "Lg", "Sc", "Su"];

/**
 * The four attributes as their Aspect marks with each tier as pips under it, no words: where a row of four has no room
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
        <KitIcon code={MARKS[index]} size={22} />
        <span aria-hidden className="flex gap-px">
          {TIER_WORDS.map((word, pip) => (
            <i
              key={word}
              className={
                pip < tiers[index]
                  ? "size-[5px] rounded-full bg-kit-gold"
                  : "size-[5px] rounded-full border border-kit-line2"
              }
            />
          ))}
        </span>
      </span>
    ))}
  </span>
);
