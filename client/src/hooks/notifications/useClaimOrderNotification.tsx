import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { NotificationType } from "./useNotifications";
import { findResourceById } from "@bibliothecadao/eternum";
import { useTrade } from "../helpers/useTrade";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { currencyFormat } from "../../utils/utils";
import { useState } from "react";
import { BigNumberish } from "starknet";
import Button from "../../elements/Button";

export const useClaimOrderNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const orderId = notification.keys[0];

  const { getTradeResources, claimOrder } = useTrade();

  const [isLoading, setIsLoading] = useState(false);

  const realmId =
    notification.data && "destinationRealmId" in notification.data ? notification.data.destinationRealmId : undefined;

  const tradeId = notification.data && "tradeId" in notification.data ? notification.data.tradeId : undefined;
  const realmEntityId =
    notification.data && "realmEntityId" in notification.data ? notification.data.realmEntityId : undefined;

  const realmName = realmId ? getRealmNameById(realmId) : "";
  const realmOrderName = realmId ? getRealmOrderNameById(realmId) : "";

  let claimableResources = orderId ? getTradeResources(parseInt(orderId)) : undefined;

  const claim = async () => {
    setIsLoading(true);
    await claimOrder(realmEntityId as BigNumberish, tradeId as BigNumberish, claimableResources);
    setIsLoading(false);
  };

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
    content: (onClose: () => void) => (
      <div className="flex flex-col">
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
        <Button
          isLoading={isLoading}
          onClick={async () => {
            await claim();
            onClose();
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Claim
        </Button>
      </div>
    ),
  };
};
