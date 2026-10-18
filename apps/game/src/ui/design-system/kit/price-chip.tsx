import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { formatCharge } from "./amount";

import { PRICE_FACES, type PriceKind } from "./price-faces";

/** A price: its resource (or XP) and the amount it charges, on the price chip a button carries. Unknown is a dash. */
export const PriceChip = ({ of, amount }: { of: PriceKind; amount: number | undefined }) => {
  const { word, icon } = PRICE_FACES[of];
  const shown = formatCharge(amount);
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
