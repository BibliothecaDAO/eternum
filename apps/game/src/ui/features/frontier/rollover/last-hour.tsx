import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { formatExact } from "@/ui/design-system/kit/amount";

import { TROOPS, UPGRADE } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * The last hour's bubble over the map (wireframe 11): the troops still out, in amber because the day's end takes
 * them, the troops their Homecoming will return, and the tiers still to buy. What the facts do not carry yet is left
 * out, never zero.
 */
export const LastHourBubble = ({
  troopsOut,
  returned,
  tiersToBuy,
}: {
  troopsOut: number;
  returned?: number;
  tiersToBuy?: number;
}) => (
  <div
    role="status"
    className="pointer-events-auto absolute left-1.5 top-5 flex max-w-[250px] flex-wrap gap-1.5 rounded-xl border-2 border-kit-hot bg-kit-ground p-1.5"
  >
    <Bubble label={TROOPS} value={formatExact(troopsOut)} hot>
      <SemanticIcon name="troops" size={18} />
    </Bubble>
    {returned !== undefined && (
      <Bubble label={TROOPS} value={`+${formatExact(returned)}`}>
        <SemanticIcon name="order-enlightenment" size={18} />
        <SemanticIcon name="troops" size={18} />
      </Bubble>
    )}
    {tiersToBuy !== undefined && tiersToBuy > 0 && (
      <Bubble label={UPGRADE} value={formatExact(tiersToBuy)} hot>
        <SemanticIcon name="picks" className="size-[18px]" />
      </Bubble>
    )}
  </div>
);

const Bubble = ({
  label,
  value,
  hot = false,
  children,
}: {
  label: string;
  value: string;
  hot?: boolean;
  children: ReactNode;
}) => (
  <span aria-label={`${label} ${value}`} className="frontier-chip h-7 !py-0">
    <span className="contents">
      <span className="flex -space-x-1">{children}</span>
      <span
        className={
          hot
            ? "frontier-chip-number tabular-nums !text-base !text-kit-hot"
            : "frontier-chip-number tabular-nums !text-base"
        }
      >
        {value}
      </span>
    </span>
  </span>
);
