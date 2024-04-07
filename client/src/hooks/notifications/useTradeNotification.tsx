import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../ui/elements/OrderIcon";
import { ReactComponent as RatioIcon } from "@/assets/icons/common/ratio.svg";
import { useDojo } from "../context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { Badge } from "../../ui/elements/Badge";
import { divideByPrecision, extractAndCleanKey, getEntityIdFromKeys } from "../../ui/utils/utils";
import { useTrade } from "../helpers/useTrade";
import { calculateRatio } from "../../ui/components/cityview/realm/trade/Market/MarketOffer";
import { getRealmNameById, getRealmOrderNameById } from "../../ui/utils/realms";
import useRealmStore from "../store/useRealmStore";
import { EventType, NotificationType } from "../store/useNotificationsStore";
import { ResourceCost } from "../../ui/elements/ResourceCost";
import Button from "../../ui/elements/Button";
import { useLocation } from "wouter";
import useUIStore from "../store/useUIStore";

export const useGoToDirectOffers = () => {
  const { setRealmId, setRealmEntityId } = useRealmStore();
  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const goToDirectOffers = (realmId: bigint, realmEntityId: bigint) => {
    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      if (location.includes(`/realm`)) {
        setIsLoadingScreenEnabled(false);
      }
      setLocation(`/realm/${Number(realmEntityId)}/direct-offers`);
      setRealmEntityId(realmEntityId);
      setRealmId(realmId);
    }, 500);
  };

  return {
    goToDirectOffers,
  };
};

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

  const { getTradeResourcesFromEntityViewpoint } = useTrade();

  let trade = getComponentValue(Trade, getEntityIdFromKeys(extractAndCleanKey(notification.keys)));

  let makerId = trade ? trade.maker_id : undefined;
  let takerId = trade ? trade.taker_id : undefined;

  const makerRealm = makerId ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(makerId)])) : undefined;

  const takerRealm = takerId ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(takerId)])) : undefined;

  const makerRealmName = makerRealm ? getRealmNameById(makerRealm.realm_id) : "";

  const takerRealmName = takerRealm ? getRealmNameById(takerRealm.realm_id) : "";

  const makerOrderName = makerRealm ? getRealmOrderNameById(makerRealm?.realm_id) : "";

  const takerOrderName = takerRealm ? getRealmOrderNameById(takerRealm?.realm_id) : "";

  let { resourcesGet: orderResources1, resourcesGive: orderResources2 } = getTradeResourcesFromEntityViewpoint(
    takerId || 0n,
    trade?.trade_id || 0n,
  );

  const { goToDirectOffers } = useGoToDirectOffers();

  let type: "primary" | "success" | "danger";
  let msg: string;
  switch (notification.eventType) {
    case EventType.DirectOffer:
      type = "primary";
      msg = "Direct Order";
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
          from
          <OrderIcon
            size="xs"
            className="mx-1"
            order={notification.eventType === EventType.AcceptOffer ? takerOrderName : makerOrderName}
          />{" "}
          <div className="inline-block text-gold">
            {notification.eventType === EventType.AcceptOffer ? takerRealmName : makerRealmName}
          </div>
        </div>
        <div className="flex ml-1 items-center">
          for
          <div className="inline-block ml-1 text-gold">
            {notification.eventType === EventType.AcceptOffer ? makerRealmName : takerRealmName}
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
                  <ResourceCost
                    amount={divideByPrecision(amount)}
                    resourceId={resourceId}
                    color="text-order-brilliance"
                    type="vertical"
                    className="mb-1"
                  />
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
                  <ResourceCost
                    amount={-divideByPrecision(amount)}
                    resourceId={resourceId}
                    color="text-order-giants"
                    type="vertical"
                    className="mb-1"
                  />
                </div>
              ))}
          </div>
        </div>
        {takerRealm && takerId !== undefined && (
          <Button
            onClick={() => {
              goToDirectOffers(takerRealm?.realm_id, takerId || 0n);
            }}
            className="w-full"
            variant="success"
            size="xs"
          >
            Go to realm
          </Button>
        )}
      </div>
    ),
  };
};
