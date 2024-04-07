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
import { CaravanInterface, DESTINATION_TYPE } from "@bibliothecadao/eternum";
import { CAPACITY_PER_DONKEY } from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { getTotalResourceWeight } from "../utils";
import { divideByPrecision } from "../../../../../utils/utils";
import { useResources } from "../../../../../hooks/helpers/useResources";
import Button from "../../../../../elements/Button";
import { useDojo } from "../../../../../context/DojoContext";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";

type CaravanProps = {
  caravan: CaravanInterface;
  idleOnly?: boolean;
  selectedCaravan?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Caravan = ({ caravan, ...props }: CaravanProps) => {
  const {
    caravanId,
    arrivalTime,
    isRoundTrip,
    intermediateDestination,
    blocked,
    capacity,
    pickupArrivalTime,
    destinationType,
  } = caravan;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const {
    account: { account },
    setup: {
      systemCalls: { disassemble_caravan_and_return_free_units },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = React.useState(false);

  const { getResourcesFromInventory } = useResources();
  const { getCaravanMembers } = useCaravan();

  const resourcesGet = getResourcesFromInventory(caravanId);

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...resourcesGet.resources]);
  }, [resourcesGet]);

  const intermediateDestinationRealmId = intermediateDestination
    ? getRealmIdByPosition(intermediateDestination)
    : undefined;
  const destinationRealmName = intermediateDestinationRealmId
    ? getRealmNameById(intermediateDestinationRealmId)
    : undefined;

  const isTraveling = !blocked && nextBlockTimestamp && arrivalTime && arrivalTime > nextBlockTimestamp;
  const isWaitingForDeparture = blocked;
  const isIdle = !isTraveling && !isWaitingForDeparture && !resourceWeight;
  const isWaitingToOffload = !blocked && !isTraveling && resourceWeight > 0;
  const hasArrivedPickupPosition =
    pickupArrivalTime !== undefined && nextBlockTimestamp !== undefined && pickupArrivalTime <= nextBlockTimestamp;

  if ((blocked || isTraveling) && props.idleOnly) {
    return null;
  }

  const isTrading =
    isTraveling &&
    destinationType === DESTINATION_TYPE.HOME &&
    intermediateDestinationRealmId !== undefined &&
    destinationRealmName;

  const redeemDonkeys = async () => {
    setIsLoading(true);
    let unit_ids = getCaravanMembers(caravanId);
    await disassemble_caravan_and_return_free_units({
      signer: account,
      caravan_id: caravanId,
      unit_ids,
    });
    return unit_ids;
  };

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs">
        <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
          #{Number(caravan.caravanId)}
        </div>
        <div className="flex items-center ml-1 -mt-2">
          {!isTraveling && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">{`Waiting ${
                destinationType === DESTINATION_TYPE.HOME ? "" : "on"
              }`}</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                {destinationType === DESTINATION_TYPE.BANK
                  ? "bank"
                  : destinationType === DESTINATION_TYPE.HYPERSTRUCTURE
                  ? "hyperstructure"
                  : "home"}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {/* when you are trading */}
          {isTrading && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling {hasArrivedPickupPosition ? "from" : "to"}</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(intermediateDestinationRealmId)} className="mr-1" size="xxs" />
                {destinationRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {/* when you are not trading (trading is round trip) it means you are either going to/coming from bank/hyperstructure */}
          {isTraveling && !isRoundTrip && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">{`Traveling ${
                destinationType === DESTINATION_TYPE.HOME ? "" : "to"
              }`}</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                {destinationType === DESTINATION_TYPE.BANK
                  ? "bank"
                  : destinationType === DESTINATION_TYPE.HYPERSTRUCTURE
                  ? "hyperstructure"
                  : "home"}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {capacity && resourceWeight !== undefined && (
            <div className="flex items-center ml-1 text-gold">
              {!isIdle && hasArrivedPickupPosition ? divideByPrecision(Math.round(resourceWeight)) : 0}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${capacity / 1000} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
        {isWaitingForDeparture && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Trade Bound <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {isWaitingToOffload && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Waiting to offload <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {isIdle && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex justify-center items-center space-x-2 flex-wrap mt-2">
        {!isIdle &&
          !isWaitingForDeparture &&
          hasArrivedPickupPosition &&
          resourcesGet &&
          resourcesGet.resources.map(
            (resource) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  className="!text-gold !w-5 mt-0.5"
                  type="vertical"
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(resource.amount)}
                />
              ),
          )}
      </div>
      <div className="flex w-full mt-2">
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
                  <div className="mt-1 text-green">{(capacity || 0) / CAPACITY_PER_DONKEY}</div>
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
              <div className="">
                <Button variant="success" isLoading={isLoading} disabled={!isIdle} size="xs" onClick={redeemDonkeys}>
                  Redeem
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
