import React, { useMemo } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import ProgressBar from "../../../../../elements/ProgressBar";
import { Dot } from "../../../../../elements/Dot";
import clsx from "clsx";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import {
  CaravanInterface,
  useGetCounterPartyOrderId,
  useSyncCaravanInfo,
} from "../../../../../hooks/graphql/useGraphQLQueries";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById, getTotalResourceWeight } from "../TradeUtils";
import { CAPACITY_PER_DONKEY } from "../../../../../constants/travel";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";
import { useTrade } from "../../../../../hooks/helpers/useTrade";
import { ResourceCost } from "../../../../../elements/ResourceCost";

type CaravanProps = {
  caravan: CaravanInterface;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Caravan = ({ caravan, ...props }: CaravanProps) => {
  const { nextBlockTimestamp } = useBlockchainStore();

  const { counterPartyOrderId } = useGetCounterPartyOrderId(caravan.orderId);

  useSyncCaravanInfo(caravan.caravanId, caravan.orderId, counterPartyOrderId);

  const { getCaravanInfo } = useCaravan();
  const caravanInfo = getCaravanInfo(caravan.caravanId, caravan.orderId);

  const { getTradeResources } = useTrade();
  let resourcesGive = getTradeResources(caravan.orderId);

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...resourcesGive]);
  }, [resourcesGive]);

  const destinationRealmId = caravanInfo?.destination && getRealmIdByPosition(caravanInfo.destination);
  const destinationRealmName = destinationRealmId && getRealmNameById(destinationRealmId);

  const isTraveling =
    caravanInfo &&
    !caravanInfo.blocked &&
    nextBlockTimestamp &&
    caravanInfo.arrivalTime &&
    caravanInfo.arrivalTime > nextBlockTimestamp;
  const isWaitingForDeparture = caravanInfo && caravanInfo.blocked;
  const isIdle =
    nextBlockTimestamp &&
    caravanInfo &&
    caravanInfo.arrivalTime &&
    caravanInfo.arrivalTime <= nextBlockTimestamp &&
    !caravanInfo.blocked;

  if (((caravanInfo && caravanInfo.blocked) || isTraveling) && props.idleOnly) {
    return null;
  }

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs">
        <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
          #{caravan.caravanId}
        </div>
        <div className="flex items-center ml-1 -mt-2">
          {isTraveling && destinationRealmName && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling to</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                {destinationRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {caravanInfo && resourceWeight !== undefined && caravanInfo.capacity && (
            <div className="flex items-center ml-1 text-gold">
              {isTraveling || isWaitingForDeparture ? resourceWeight : 0}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${caravanInfo.capacity / 1000} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
        {isWaitingForDeparture && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Waiting departure <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {isIdle && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {isTraveling && nextBlockTimestamp && caravanInfo.arrivalTime && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(caravanInfo.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex justify-center items-center space-x-2 flex-wrap mt-2">
        {!isIdle &&
          resourcesGive &&
          resourcesGive.map(
            (resource) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  className="!text-gold !w-5 mt-0.5"
                  type="vertical"
                  resourceId={resource.resourceId}
                  amount={resource.amount}
                />
              ),
          )}
      </div>
      <div className="flex mt-2">
        <div className="grid w-full grid-cols-1 gap-5">
          <div className="flex flex-col">
            <div className="grid grid-cols-12 gap-0.5">
              <ProgressBar containerClassName="col-span-12" rounded progress={100} />
            </div>
            <div className="flex items-center justify-between mt-[6px] text-xxs">
              <DonkeyIcon />
              <div className="flex items-center space-x-[6px]">
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-green" />
                  <div className="mt-1 text-green">{(caravanInfo?.capacity || 0) / CAPACITY_PER_DONKEY}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-yellow" />
                  <div className="mt-1 text-dark">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-orange" />
                  <div className="mt-1 text-orange">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-red" />
                  <div className="mt-1 text-red">{0}</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-light-pink" />
                  <div className="mt-1 text-dark">{0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
