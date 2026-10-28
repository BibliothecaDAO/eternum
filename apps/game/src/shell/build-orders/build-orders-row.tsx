import { useActiveBuildOrder, useBuildOrderAccount, useBuildOrders } from "@/hooks/use-build-orders";
import { Icon } from "@/ui/design-system/icon";
import { AppRow } from "@/ui/design-system/kit/app-elements";
import { BUILD_ORDER_WORDS } from "@/ui/design-system/kit/words";
import type { BuildOrder } from "@bibliothecadao/eternum/automation";
import { useNavigate } from "react-router-dom";

import { BUILD_ORDERS_PATH } from "./build-orders-route";

/** Play's way to the build orders, at the foot of Blitz's column: it names the order the player's next Blitz follows. */
export const BuildOrdersRow = () => {
  useBuildOrderAccount();
  const navigate = useNavigate();
  const order = useActiveBuildOrder();
  const { book, status, notice } = useBuildOrders();
  return (
    <AppRow
      lead={<Icon name="build" size={28} />}
      title={BUILD_ORDER_WORDS.page}
      detail={followedName(order, book?.active ?? null, status === "error" ? notice : null)}
      onClick={() => navigate(BUILD_ORDERS_PATH)}
    />
  );
};

/** The order named on the row: the account's, the game's, why the account's could not be read, or nothing while they are read. */
const followedName = (order: BuildOrder | null, active: string | null, failure: string | null): string | undefined => {
  if (order) return active ? order.name : BUILD_ORDER_WORDS.theGamesOrder;
  return failure ?? undefined;
};
