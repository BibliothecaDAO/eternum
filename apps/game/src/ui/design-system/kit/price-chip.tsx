import { formatExact } from "./amount";

import { type IconCode, KitIcon } from "./kit-icon";
import { ESSENCE, LABOR, LORDS, STAMINA, TROOPS, WHEAT, XP } from "./words";

/** What a price is paid in: a resource, LORDS, stamina, or XP (drawn as its word, the XP badge being a number alone). */
export type PriceKind = "essence" | "labor" | "wheat" | "troops" | "lords" | "stamina" | "xp";

const KINDS: Record<PriceKind, { word: string; icon?: IconCode }> = {
  essence: { word: ESSENCE, icon: "Es" },
  labor: { word: LABOR, icon: "La" },
  wheat: { word: WHEAT, icon: "Wh" },
  troops: { word: TROOPS, icon: "Tr" },
  lords: { word: LORDS, icon: "Lo" },
  stamina: { word: STAMINA, icon: "St" },
  xp: { word: XP },
};

/** A price: its resource (or XP) and the amount, on the price chip a button carries. Unknown is a dash. */
export const PriceChip = ({ of, amount }: { of: PriceKind; amount: number | undefined }) => {
  const { word, icon } = KINDS[of];
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
        {icon && <KitIcon code={icon} size={22} />}
        <span className="frontier-chip-number tabular-nums !text-[15px]">{shown}</span>
        {!icon && <span className="text-[13px] font-semibold text-[color:var(--frontier-ink)]">{word}</span>}
      </span>
    </span>
  );
};
