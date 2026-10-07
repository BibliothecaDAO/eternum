import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

import { formatAmount } from "./amount";
import { KitIcon } from "./kit-icon";
import { OrderEmblem } from "./order-emblem";

/**
 * One realm on the season list: its rank, Order, name, sites cleared (what ranks) and LORDS beside. The player's own row
 * is framed. The name is the host's PlayerName, so the one name rule draws it.
 */
export const SeasonRow = ({
  rank,
  order,
  name,
  sitesCleared,
  lords,
  own = false,
  onOpen,
}: {
  rank: number | undefined;
  order: number;
  name: ReactNode;
  sitesCleared: number | undefined;
  lords: number | undefined;
  own?: boolean;
  onOpen: () => void;
}) => (
  <button
    type="button"
    onClick={onOpen}
    aria-current={own || undefined}
    className={cn(
      "flex h-[52px] w-full shrink-0 items-center gap-2 px-1 text-left text-[color:var(--frontier-parchment)]",
      own
        ? "rounded-xl border-2 border-[color:var(--frontier-gold)] bg-[color:var(--frontier-void)]"
        : "border-b border-[color:var(--frontier-line)]",
    )}
  >
    <span className="w-[34px] shrink-0 text-center text-[15px] tabular-nums">{formatAmount(rank)}</span>
    <OrderEmblem order={order} />
    <span className="min-w-0 flex-1 truncate text-[15px]">{name}</span>
    <span className="w-12 shrink-0 text-right text-[15px] tabular-nums">{formatAmount(sitesCleared)}</span>
    <span className="w-14 shrink-0 text-right text-[15px] tabular-nums">{formatAmount(lords)}</span>
    <KitIcon code="Cv" size={18} />
  </button>
);
