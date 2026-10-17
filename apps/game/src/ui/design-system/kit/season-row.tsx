import type { ReactNode } from "react";

import { formatAmount } from "./amount";
import { ListRow } from "./list-row";
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
  <ListRow
    onClick={onOpen}
    current={own}
    height="52px"
    gap={2}
    rule="under"
    own={own ? "framed" : undefined}
    chevron
    className="w-full shrink-0 px-1 text-left text-kit-cream"
  >
    <span className="w-[34px] shrink-0 text-center text-base tabular-nums">{formatAmount(rank)}</span>
    <OrderEmblem order={order} />
    <span className="min-w-0 flex-1 truncate text-base">{name}</span>
    <span className="w-12 shrink-0 text-right text-base tabular-nums">{formatAmount(sitesCleared)}</span>
    <span className="w-14 shrink-0 text-right text-base tabular-nums">{formatAmount(lords)}</span>
  </ListRow>
);
