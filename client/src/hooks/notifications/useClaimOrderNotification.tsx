import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { NotificationType } from "./useNotifications";
import { findResourceById } from "../../constants/resources";
import { useTrade } from "../helpers/useTrade";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { currencyFormat } from "../../utils/utils";

export const useClaimOrderNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: React.ReactElement;
} => {
  const orderId = notification.keys[0];

  const { getTradeResources } = useTrade();

  const realmId =
    notification.data && "destinationRealmId" in notification.data ? notification.data.destinationRealmId : undefined;

  const realmName = realmId ? getRealmNameById(realmId) : "";
  const realmOrderName = realmId ? getRealmOrderNameById(realmId) : "";

  let claimableResources = orderId ? getTradeResources(parseInt(orderId)) : undefined;

  return {
    type: "success",
    time: "13:37",
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="success" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Order Claimable`}
        </Badge>

        <div className="flex items-center">
          by <OrderIcon size="xs" className="mx-2" order={realmOrderName} />{" "}
          <div className="inline-block text-gold">{realmName}</div>
        </div>
      </div>
    ),
    // TODO: better layout for claimable resources?
    content: (
      <div className="mt-2 items-center italic">
        {claimableResources &&
          claimableResources.map(({ resourceId, amount }) => (
            <div className="flex items-center italic" key={resourceId}>
              <ResourceIcon
                containerClassName="mx-1"
                className="!w-[12px]"
                resource={findResourceById(resourceId)?.trait as any}
                size="xs"
              />
              {`+${currencyFormat(amount, 0)}`}
            </div>
          ))}
      </div>
    ),
  };
};
