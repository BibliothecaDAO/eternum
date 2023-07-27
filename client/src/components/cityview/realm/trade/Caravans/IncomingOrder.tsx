import React, { useEffect, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";

import clsx from "clsx";
import { useDojo } from "../../../../../DojoContext";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import {
  getRealmIdByPosition,
  getRealmNameById,
  getRealmOrderNameById,
} from "../TradeUtils";
import {
  IncomingOrderInterface,
  useGetIncomingOrderInfo,
} from "../../../../../hooks/graphql/useGraphQLQueries";
import { ResourceCost } from "../../../../../elements/ResourceCost";

type IncomingOrderProps = {
  incomingOrder: IncomingOrderInterface;
} & React.HTMLAttributes<HTMLDivElement>;

export const IncomingOrder = ({
  incomingOrder,
  ...props
}: IncomingOrderProps) => {
  const { realmEntityId } = useRealmStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    systemCalls: { claim_fungible_order },
    components: { ArrivalTime, FungibleEntities, Resource, Position },
  } = useDojo();

  useEffect(() => {
    setIsLoading(false);
  }, [incomingOrder.orderId]);

  const claimOrder = async () => {
    setIsLoading(true);
    claim_fungible_order({
      entity_id: realmEntityId,
      trade_id: incomingOrder.tradeId,
    });
  };

  const { incomingOrderInfo } = useGetIncomingOrderInfo({
    orderId: incomingOrder.orderId,
    counterPartyOrderId: incomingOrder.counterPartyOrderId,
  });

  const { nextBlockTimestamp } = useBlockchainStore();

  let arrivalTime = incomingOrderInfo && incomingOrderInfo.arrivalTime;

  const resourcesGet = incomingOrderInfo && incomingOrderInfo.resourcesGet;
  const originPosition = incomingOrderInfo && incomingOrderInfo.origin;
  const startRealmId =
    originPosition &&
    getRealmIdByPosition({ x: originPosition.x, y: originPosition.y });
  const startRealmName = startRealmId && getRealmNameById(startRealmId);
  const hasArrived =
    arrivalTime !== undefined &&
    nextBlockTimestamp !== undefined &&
    arrivalTime <= nextBlockTimestamp;

  return (
    <div
      className={clsx(
        "flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold",
        props.className,
      )}
      onClick={props.onClick}
    >
      {!hasArrived && startRealmName && (
        <div className="flex items-center ml-1 -mt-2">
          <span className="italic text-light-pink">Traveling from</span>
          <div className="flex items-center ml-1 mr-1 text-gold">
            <OrderIcon
              order={getRealmOrderNameById(startRealmId)}
              className="mr-1"
              size="xs"
            />
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
      {hasArrived && (
        <div className="flex ml-auto -mt-2 italic text-light-pink">
          {"Has Arrived"}
        </div>
      )}
      <div className="flex items-center mt-3 ml-2 text-xxs">
        <span className="italic text-light-pink">You will get</span>
      </div>
      {resourcesGet && (
        <div className="grid grid-cols-3 gap-2 px-2 py-1">
          {resourcesGet.map(
            (resource) =>
              resource && (
                <ResourceCost
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
            claimOrder();
          }}
          disabled={!hasArrived}
          variant={"success"}
          className="ml-auto p-2 !h-4 text-xxs !rounded-md"
        >{`Claim`}</Button>
      )}
      {isLoading && (
        <Button
          isLoading={true}
          onClick={() => {}}
          variant="danger"
          className="ml-auto p-2 !h-4 text-xxs !rounded-md"
        >
          {}
        </Button>
      )}
    </div>
  );
};
