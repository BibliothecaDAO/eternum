import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { formatExact } from "./amount";

import { ESSENCE, LABOR, LORDS, STAMINA, TROOPS, WHEAT, XP } from "./words";

/** What a price is paid in: a resource, LORDS, stamina, or XP (drawn as its word, the XP badge being a number alone). */
export type PriceKind = "essence" | "labor" | "wheat" | "troops" | "lords" | "stamina" | "xp";

export const PRICE_FACES: Record<PriceKind, { word: string; icon?: IconMeaning }> = {
  essence: { word: ESSENCE, icon: "essence" },
  labor: { word: LABOR, icon: "labor" },
  wheat: { word: WHEAT, icon: "wheat" },
  troops: { word: TROOPS, icon: "troops" },
  lords: { word: LORDS, icon: "lords" },
  stamina: { word: STAMINA, icon: "stamina" },
  xp: { word: XP },
};

/** A price: its resource (or XP) and the amount, on the price chip a button carries. Unknown is a dash. */
export const PriceChip = ({ of, amount }: { of: PriceKind; amount: number | undefined }) => {
  const { word, icon } = PRICE_FACES[of];
  const shown = formatExact(amount);
  return (
    <span
      role="img"
      aria-label={`${shown} ${word}`}
      data-tone="price"
      className="frontier-chip h-8 shrink-0 !gap-1 !py-0 !pl-1.5 !pr-2.5"
    >
      {/* `contents` takes the chip token's fixed-size first child, so an XP price with no icon keeps its width. */}
      <span className="contents">
        {icon && <SemanticIcon name={icon} size={22} />}
        <span className="frontier-chip-number tabular-nums !text-base">{shown}</span>
        {!icon && <span className="text-sm font-semibold text-kit-cream">{word}</span>}
      </span>
    </span>
  );
};
