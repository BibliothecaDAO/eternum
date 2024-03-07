import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { useState } from "react";
import Button from "../../elements/Button";
import { useResources } from "../helpers/useResources";
import { ResourceCost } from "../../elements/ResourceCost";
import { divideByPrecision } from "../../utils/utils";
import { NotificationType } from "../store/useNotificationsStore";

export const useEmptyChestNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const { getResourcesFromInventory, offloadChests } = useResources();

  const [isLoading, setIsLoading] = useState(false);

  const realmId =
    notification.data && "destinationRealmId" in notification.data ? notification.data.destinationRealmId : undefined;

  const entityId = notification.data && "entityId" in notification.data ? notification.data.entityId : undefined;
  const realmEntityId =
    notification.data && "realmEntityId" in notification.data ? notification.data.realmEntityId : undefined;

  const realmName = realmId ? getRealmNameById(realmId) : "";
  const realmOrderName = realmId ? getRealmOrderNameById(realmId) : "";

  let claimableResources = entityId ? getResourcesFromInventory(entityId) : undefined;

  const emptyChest = async () => {
    setIsLoading(true);
    if (claimableResources && realmEntityId && entityId) {
      await offloadChests(realmEntityId, entityId, claimableResources.indices, claimableResources.resources);
      setIsLoading(false);
    }
  };

  return {
    type: "success",
    time: "13:37",
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="success" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Resources claimable`}
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
        <div className="flex mt-2 w-full items-center justify-start flex-wrap space-x-2 space-y-1">
          {claimableResources &&
            claimableResources.resources.map(({ resourceId, amount }) => (
              <ResourceCost
                // type="vertical"
                withTooltip
                key={resourceId}
                resourceId={resourceId}
                color="text-order-brilliance"
                amount={divideByPrecision(Number(amount))}
              />
            ))}
        </div>
        <Button
          isLoading={isLoading}
          onClick={async () => {
            await emptyChest();
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
