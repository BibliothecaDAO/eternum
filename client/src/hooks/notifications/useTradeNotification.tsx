import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { ReactComponent as RatioIcon } from "../../assets/icons/common/ratio.svg";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { Badge } from "../../elements/Badge";
import { currencyFormat, extractAndCleanKey, getEntityIdFromKeys } from "../../utils/utils";
import { useTrade } from "../helpers/useTrade";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { findResourceById } from "@bibliothecadao/eternum";
import { calculateRatio } from "../../components/cityview/realm/trade/Market/MarketOffer";
import { EventType, NotificationType } from "./useNotifications";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";

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
      components: { Trade, Realm },
    },
  } = useDojo();

  const { getTradeResources } = useTrade();

  let trade = getComponentValue(Trade, getEntityIdFromKeys(extractAndCleanKey(notification.keys)));

  let makerId = trade ? trade.maker_id : undefined;
  let takerId = trade ? trade.taker_id : undefined;

  const makerRealm = makerId ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(makerId)])) : undefined;

  const takerRealm = takerId ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(takerId)])) : undefined;

  const makerRealmName = makerRealm ? getRealmNameById(makerRealm.realm_id) : "";

  const takerRealmName = takerRealm ? getRealmNameById(takerRealm.realm_id) : "";

  const makerOrderName = makerRealm ? getRealmOrderNameById(makerRealm?.realm_id) : "";

  const takerOrderName = takerRealm ? getRealmOrderNameById(takerRealm?.realm_id) : "";

  let orderResources1 = getTradeResources(trade?.maker_order_id || 0);
  let orderResources2 = getTradeResources(trade?.taker_order_id || 0);

  let type: "primary" | "success" | "danger";
  let msg: string;
  switch (notification.eventType) {
    case EventType.MakeOffer:
      type = "primary";
      msg = "Order Created";
      break;
    case EventType.AcceptOffer:
      type = "success";
      msg = "Order Accepted";
      break;
    case EventType.CancelOffer:
      type = "danger";
      msg = "Order Cancelled";
      break;
    default:
      type = "primary";
      msg = "";
  }

  return {
    type,
    time: "13:37",
    title: (
      <div className="flex items-center">
        <Badge size="lg" type={type} className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {msg}
        </Badge>

        <div className="flex items-center">
          by{" "}
          <OrderIcon
            size="xs"
            className="mx-2"
            order={notification.eventType === EventType.AcceptOffer ? takerOrderName : makerOrderName}
          />{" "}
          <div className="inline-block text-gold">
            {notification.eventType === EventType.AcceptOffer ? takerRealmName : makerRealmName}
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
                <div className="flex flex-col items-center mx-2 my-1" key={resourceId}>
                  <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="xs" className="mb-1" />
                  {currencyFormat(amount, 0)}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {orderResources1 && orderResources2 && calculateRatio(orderResources1, orderResources2).toFixed(2)}
          </div>
          <div className="w-1/3 text-gold flex justify-center items-center flex-wrap">
            {orderResources2 &&
              orderResources2.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center mx-2 my-1" key={resourceId}>
                  <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="xs" />
                  {currencyFormat(amount, 0)}
                </div>
              ))}
          </div>
        </div>
      </div>
    ),
  };
};
