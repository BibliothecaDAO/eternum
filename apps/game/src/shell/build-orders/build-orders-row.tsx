import { useActiveBuildOrder, useBuildOrderAccount, useBuildOrders } from "@/hooks/use-build-orders";
import { Icon } from "@/ui/design-system/icon";
import { AppRow } from "@/ui/design-system/kit/app-elements";
import { BUILD_ORDER_WORDS } from "@/ui/design-system/kit/words";
import { useNavigate } from "react-router-dom";

import { BUILD_ORDERS_PATH } from "./build-orders-route";

/** Play's way to the build orders, at the foot of Blitz's column: it names the order the player's next Blitz follows. */
export const BuildOrdersRow = () => {
  useBuildOrderAccount();
  const navigate = useNavigate();
  const order = useActiveBuildOrder();
  const followed = useBuildOrders().book?.active ? order.name : BUILD_ORDER_WORDS.theGamesOrder;
  return (
    <AppRow
      lead={<Icon name="build" size={28} />}
      title={BUILD_ORDER_WORDS.page}
      detail={followed}
      onClick={() => navigate(BUILD_ORDERS_PATH)}
    />
  );
};
