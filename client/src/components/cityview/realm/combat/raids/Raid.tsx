import React, { useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { useDojo } from "../../../../../DojoContext";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { getTotalResourceWeight } from "../../trade/TradeUtils";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";
import { divideByPrecision } from "../../../../../utils/utils";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import useUIStore from "../../../../../hooks/store/useUIStore";

type RaidProps = {
  raider: CombatInfo;
  setShowTravelRaid: (show: boolean) => void;
  setShowAttackRaid: (show: boolean) => void;
  setShowManageRaid: (show: boolean) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const Raid = ({ raider, ...props }: RaidProps) => {
  const { entityId, health, quantity, capacity, attack, defence } = raider;
  const { setShowAttackRaid, setShowManageRaid, setShowTravelRaid } = props;

  const {
    account: { account },
    setup: {
      systemCalls: { travel },
    },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();
  const [isLoading, setIsLoading] = useState(false);

  const { getResourcesFromInventory, offloadChest } = useResources();
  const { getInventoryResourcesChestId } = useCaravan();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const inventoryResources = raider.entityId ? getResourcesFromInventory(raider.entityId) : undefined;
  const resourceChestId = raider.entityId ? getInventoryResourcesChestId(raider.entityId) : undefined;

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...inventoryResources]);
  }, [inventoryResources]);

  // offload
  const onOffload = async () => {
    setIsLoading(true);
    await offloadChest(realmEntityId, raider.entityId, resourceChestId, 0, inventoryResources);
  };

  const onReturn = async () => {
    if (raider.homePosition) {
      setIsLoading(true);
      await travel({
        signer: account,
        travelling_entity_id: raider.entityId,
        destination_coord_x: raider.homePosition.x,
        destination_coord_y: raider.homePosition.y,
      });
      setIsLoading(false);
    }
  };

  const hasResources = inventoryResources && inventoryResources.length > 0;
  const isTraveling = raider.arrivalTime ? raider.arrivalTime > nextBlockTimestamp : false;
  const destinationRealmId = raider.position ? getRealmIdByPosition(raider.position) : undefined;
  const destinationRealmName = destinationRealmId ? getRealmNameById(destinationRealmId) : undefined;
  const isHome = destinationRealmId === realmId;

  // const destinationDefence = getDefenceOnPosition(raider.position);

  return (
    <div
      className={clsx(
        "flex flex-col relative p-2 border rounded-md border-gray-gold text-xxs text-gray-gold",
        props.className,
      )}
      onClick={props.onClick}
    >
      <div className="flex absolute w-full -left-[1px] -top-[1px] items-center text-xxs">
        {entityId && (
          <div
            className={clsx(
              "flex items-center p-1 border text-light-pink rounded-br-md rounded-tl-md border-gray-gold",
              isTraveling && "!border-orange !text-orange",
              !isTraveling && isHome && "!text-order-brilliance !border-order-brilliance",
              !isTraveling && destinationRealmName && !isHome && "!text-order-giants !border-order-giants",
            )}
          >
            {isTraveling && destinationRealmName && !isHome && "Outgoing"}
            {isTraveling && isHome && "Incoming"}
            {!isTraveling && isHome && "At the base"}
            {!isTraveling && destinationRealmName && !isHome && "Ready for attack"}
          </div>
        )}
        <div className="flex items-center ml-1">
          {isTraveling && destinationRealmName && !isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling to</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                {destinationRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {isTraveling && isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling home</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {!isTraveling && isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Home</span>
            </div>
          )}
          {!isTraveling && destinationRealmName && !isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Waiting on</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                {destinationRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {capacity && (
            <div className="flex items-center ml-1 text-gold">
              {divideByPrecision(resourceWeight)}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${divideByPrecision(capacity * quantity)} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
        {!isTraveling && (
          <div className="flex ml-auto italic text-gold mr-1">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto italic text-light-pink mr-1">
            {formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex flex-col mt-6 space-y-2">
        <div className="flex relative justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex ml-1 text-center">
                <div className="bold mr-1">x{quantity}</div>
                Battalions
              </div>
            </div>
          </div>
          <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{attack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/defence.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{defence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-order-brilliance">{health && health.toLocaleString()}</div>&nbsp;/ {10 * quantity} HP
          </div>
        </div>
        {health && (
          <div className="grid grid-cols-12 gap-0.5">
            <ProgressBar
              containerClassName="col-span-12 !bg-order-giants"
              rounded
              progress={(health / (10 * quantity)) * 100}
            />
          </div>
        )}
        <div className="flex items-center justify-between mt-[8px] text-xxs">
          {inventoryResources && (
            <div className="flex justify-center items-center space-x-1 flex-wrap">
              {inventoryResources.map(
                (resource) =>
                  resource && (
                    <ResourceCost
                      key={resource.resourceId}
                      type="vertical"
                      color="text-order-brilliance"
                      resourceId={resource.resourceId}
                      amount={divideByPrecision(resource.amount)}
                    />
                  ),
              )}
            </div>
          )}
          <div className="flex space-x-2">
            {!hasResources && !isTraveling && isHome && (
              <Button
                size="xs"
                className="ml-auto"
                onClick={() => {
                  setShowTravelRaid(true);
                }}
                variant="outline"
                withoutSound
              >
                {`Travel`}
              </Button>
            )}
            {!isTraveling && !isHome && !isLoading && (
              <Button size="xs" className="ml-auto" onClick={onReturn} variant="outline" withoutSound>
                {`Return`}
              </Button>
            )}
            {!isTraveling && !isHome && isLoading && (
              <Button size="xs" className="ml-auto" onClick={() => {}} isLoading={true} variant="outline" withoutSound>
                {`Return`}
              </Button>
            )}
            {!isTraveling && !isHome && !isLoading && (
              <Button
                size="xs"
                className="ml-auto"
                disabled={false}
                onClick={() => {
                  setShowAttackRaid(true);
                }}
                variant="outline"
                withoutSound
              >
                {`Attack`}
              </Button>
            )}
            {!hasResources && !isTraveling && isHome && (
              <Button
                size="xs"
                className="ml-auto"
                disabled={false}
                onClick={() => {
                  setShowManageRaid(true);
                }}
                variant="outline"
                withoutSound
              >
                {`Manage`}
              </Button>
            )}
            {hasResources && isHome && (
              <Button
                size="xs"
                className="ml-auto"
                disabled={isTraveling}
                onClick={onOffload}
                variant={isTraveling ? "danger" : "success"}
                withoutSound
              >
                {`Claim`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
