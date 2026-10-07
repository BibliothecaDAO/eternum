import { cn } from "@/ui/design-system/atoms/lib/utils";

import { TIER_WORDS } from "./words";

export type Tier = 1 | 2 | 3 | 4 | 5;

/**
 * Each tier's frame, common to legendary: one set for chests, building types and attributes. The frame thickens and
 * warms with the tier; the art pass's five frames replace these borders.
 */
const FRAMES: Record<Tier, string> = {
  1: "border border-kit-line2",
  2: "border-2 border-kit-muted",
  3: "border-[3px] border-double border-kit-gold",
  4: "border-4 border-double border-kit-gold2",
  5: "border-[5px] border-double border-kit-hot shadow-[0_0_10px_theme(colors.kit.hot)]",
};

/**
 * A tier on its own framed chip with its pips. The word stands alone on the chip, never beside a noun ("Farms · Rare"
 * read as scarce farms); where a card has no room the frame and pips carry the tier without it.
 */
export const TierChip = ({ tier, showWord }: { tier: Tier; showWord: boolean }) => (
  <span
    role="img"
    aria-label={TIER_WORDS[tier - 1]}
    className={cn(
      "inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-kit-ground px-2",
      FRAMES[tier],
    )}
  >
    <Pips tier={tier} />
    {showWord && (
      <span aria-hidden className="text-[12px] font-semibold text-kit-cream">
        {TIER_WORDS[tier - 1]}
      </span>
    )}
  </span>
);

const Pips = ({ tier }: { tier: Tier }) => (
  <span aria-hidden className="inline-flex gap-[3px]">
    {TIER_WORDS.map((word, index) => (
      <i key={word} className={cn("size-[7px] rounded-full border border-kit-gold", index < tier && "bg-kit-gold")} />
    ))}
  </span>
);
