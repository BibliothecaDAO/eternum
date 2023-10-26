import React, { useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";

import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";

type IncomingOrderProps = {
  caravanId: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const IncomingOrder = ({ caravanId, ...props }: IncomingOrderProps) => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const [isLoading, setIsLoading] = useState(false);
  const { getResourcesChestFromInventory, emptyResourceChest } = useResources();
  const { getCaravanInfo } = useCaravan();

  const { resourcesChestId, destination, arrivalTime } = getCaravanInfo(caravanId);

  const resourcesGet = getResourcesChestFromInventory(caravanId);

  // useEffect(() => {
  //   setIsLoading(false);
  // }, [incomingOrder.orderId]);

  const emptyChest = async () => {
    setIsLoading(true);
    await emptyResourceChest(realmEntityId, caravanId, resourcesChestId, resourcesGet);
  };

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const startRealmId = destination && getRealmIdByPosition({ x: destination.x, y: destination.y });
  const startRealmName = startRealmId && getRealmNameById(startRealmId);
  const hasArrived = arrivalTime !== undefined && nextBlockTimestamp !== undefined && arrivalTime <= nextBlockTimestamp;

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs">
        <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
          #{caravanId}
        </div>
        {!hasArrived && startRealmName && (
          <div className="flex items-center ml-1 -mt-2">
            <span className="italic text-light-pink">Traveling from</span>
            <div className="flex items-center ml-1 mr-1 text-gold">
              <OrderIcon order={getRealmOrderNameById(startRealmId)} className="mr-1" size="xxs" />
              {startRealmName}
            </div>
            <span className="italic text-light-pink"></span>
          </div>
        )}
        {!hasArrived && nextBlockTimestamp && arrivalTime && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(arrivalTime - nextBlockTimestamp)}
          </div>
        )}
        {hasArrived && <div className="flex ml-auto -mt-2 italic text-order-brilliance">Arrived!</div>}
      </div>
      <div className="flex mt-1">
        {resourcesGet && (
          <div className="flex justify-center items-center space-x-2 flex-wrap mt-2">
            {resourcesGet.map(
              (resource) =>
                resource && (
                  <ResourceCost
                    key={resource.resourceId}
                    type="vertical"
                    color="text-order-brilliance"
                    className="!w-5 mt-0.5"
                    resourceId={resource.resourceId}
                    amount={resource.amount}
                  />
                ),
            )}
          </div>
        )}
        {!isLoading && (
          <Button
            onClick={() => {
              emptyChest();
            }}
            disabled={!hasArrived}
            variant={hasArrived ? "success" : "danger"}
            className="ml-auto mt-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {hasArrived ? `Claim` : "On the way"}
          </Button>
        )}
        {isLoading && (
          <Button
            isLoading={true}
            onClick={() => {}}
            variant="danger"
            className="ml-auto mt-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {}
          </Button>
        )}
      </div>
    </div>
  );
};
