import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { ReactComponent as RatioIcon } from "../../assets/icons/common/ratio.svg";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { Badge } from "../../elements/Badge";
import { getEntityIdFromKeys } from "../../utils/utils";
import {
  getRealmNameById,
  getRealmOrderNameById,
} from "../../components/cityview/realm/trade/TradeUtils";
import { useTrade } from "../helpers/useTrade";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { findResourceById } from "../../constants/resources";
import { calculateRatio } from "../../components/cityview/realm/trade/Market/MarketOffer";
import { NotificationType } from "./useNotifications";

export const useTradeNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: React.ReactElement;
} => {
  const {
    setup: {
      components: { Trade, Realm, Status },
    },
  } = useDojo();

  const { getTradeResources } = useTrade();

  let trade = getComponentValue(
    Trade,
    getEntityIdFromKeys(notification.keys.map((str) => BigInt(str))),
  );

  let status = getComponentValue(
    Status,
    getEntityIdFromKeys(notification.keys.map((str) => BigInt(str))),
  );

  let orderCreated = status ? status.value === 0 : false;
  let orderAccepted = status ? status.value === 1 : false;
  let orderCancelled = status ? status.value === 2 : false;

  let makerId = trade ? trade.maker_id : undefined;
  let takerId = trade ? trade.taker_id : undefined;

  const makerRealm = makerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(makerId)]))
    : undefined;

  const takerRealm = takerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(takerId)]))
    : undefined;

  const makerRealmName = makerRealm
    ? getRealmNameById(makerRealm.realm_id)
    : "";

  const takerRealmName = takerRealm
    ? getRealmNameById(takerRealm.realm_id)
    : "";

  const makerOrderName = makerRealm
    ? getRealmOrderNameById(makerRealm?.realm_id)
    : "";

  const takerOrderName = takerRealm
    ? getRealmOrderNameById(takerRealm?.realm_id)
    : "";

  let orderResources1 = getTradeResources(trade?.maker_order_id || 0);
  let orderResources2 = getTradeResources(trade?.taker_order_id || 0);

  const type = orderCreated
    ? "primary"
    : orderAccepted
    ? "success"
    : orderCancelled
    ? "danger"
    : "primary";

  return {
    type,
    time: "13:37",
    title: (
      <div className="flex items-center">
        <Badge size="lg" type={type} className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Order ${
            orderCreated
              ? "Created"
              : orderAccepted
              ? "Accepted"
              : orderCancelled
              ? "Cancelled"
              : ""
          }`}
        </Badge>

        <div className="flex items-center">
          by{" "}
          <OrderIcon
            size="xs"
            className="mx-2"
            order={orderAccepted ? takerOrderName : makerOrderName}
          />{" "}
          <div className="inline-block text-gold">
            {orderAccepted ? takerRealmName : makerRealmName}
          </div>
        </div>
      </div>
    ),
    content: (
      <div className="mt-2 items-center italic">
        <div className="flex items-center justify-around flex-1">
          <div className="w-1/3 text-gold flex justify-center items-center flex-wrap">
            {orderResources1 &&
              orderResources1.map(({ resourceId, amount }) => (
                <div
                  className="flex flex-col items-center mx-2 my-1"
                  key={resourceId}
                >
                  <ResourceIcon
                    resource={findResourceById(resourceId)?.trait as any}
                    size="xs"
                    className="mb-1"
                  />
                  {amount}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {orderResources1 &&
              orderResources2 &&
              calculateRatio(orderResources1, orderResources2).toFixed(2)}
          </div>
          <div className="w-1/3 text-gold flex justify-center items-center flex-wrap">
            {orderResources2 &&
              orderResources2.map(({ resourceId, amount }) => (
                <div
                  className="flex flex-col items-center mx-2 my-1"
                  key={resourceId}
                >
                  <ResourceIcon
                    resource={findResourceById(resourceId)?.trait as any}
                    size="xs"
                  />
                  {amount}
                </div>
              ))}
          </div>
        </div>
      </div>
    ),
  };
};
