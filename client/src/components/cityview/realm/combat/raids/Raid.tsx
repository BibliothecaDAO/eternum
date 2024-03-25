import React, { useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as Map } from "../../../../../assets/icons/common/map.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { useDojo } from "../../../../../DojoContext";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { getTotalResourceWeight } from "../../trade/utils";
import { divideByPrecision, getUIPositionFromColRow } from "../../../../../utils/utils";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { CombatInfo, UIPosition } from "@bibliothecadao/eternum";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { useLocation } from "wouter";

type RaidProps = {
  raider: CombatInfo;
  isSelected: boolean;
  setShowTravelRaid: (show: boolean) => void;
  setShowAttackRaid: (show: boolean) => void;
  setShowManageRaid: (show: boolean) => void;
  setShowHealRaid: (show: boolean) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const Raid = ({ raider, isSelected, ...props }: RaidProps) => {
  const { entityId, health, quantity, capacity, attack, defence } = raider;
  const { setShowAttackRaid, setShowManageRaid, setShowTravelRaid, setShowHealRaid } = props;

  const {
    account: { account },
    setup: {
      systemCalls: { travel, merge_soldiers },
    },
  } = useDojo();

  const { getDefenceOnPosition } = useCombat();

  const { realmId, realmEntityId } = useRealmStore();
  const [isLoading, setIsLoading] = useState(false);

  const { getResourcesFromInventory, offloadChests } = useResources();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const inventoryResources = raider.entityId ? getResourcesFromInventory(raider.entityId) : undefined;

  // capacity
  let resourceWeight = useMemo(() => {
    return getTotalResourceWeight([...(inventoryResources?.resources || [])]);
  }, [inventoryResources]);

  const watchTowerId = useMemo(() => {
    const defence = raider?.position ? getDefenceOnPosition(raider.position) : undefined;
    return defence?.entityId;
  }, [raider]);

  // offload
  const onOffload = async () => {
    setIsLoading(true);
    if (raider?.entityId && inventoryResources) {
      // await offloadChests(realmEntityId, raider.entityId, inventoryResources.indices, inventoryResources.resources);
      await offloadChests(realmEntityId, raider.entityId, inventoryResources.indices);
    }
    setIsLoading(false);
  };

  // get entity on which they are
  const onDefend = async () => {
    if (watchTowerId) {
      setIsLoading(true);
      await merge_soldiers({
        signer: account,
        merge_into_unit_id: watchTowerId,
        units: [raider.entityId, raider.quantity],
      });
      setIsLoading(false);
    }
  };

  const onReturn = async () => {
    if (raider.homePosition) {
      setIsLoading(true);
      if (raider.entityId) {
        await travel({
          signer: account,
          travelling_entity_id: raider.entityId,
          destination_coord_x: raider.homePosition.x,
          destination_coord_y: raider.homePosition.y,
        });
        setIsLoading(false);
      }
    }
  };

  const isYours = raider.owner === BigInt(account.address);
  const hasResources = inventoryResources && inventoryResources.resources.length > 0;
  const isTraveling = raider.arrivalTime && nextBlockTimestamp ? raider.arrivalTime > nextBlockTimestamp : false;
  const hasMaxHealth = health === 10 * quantity;
  const destinationRealmId = raider.position ? getRealmIdByPosition(raider.position) : undefined;
  const destinationName = destinationRealmId ? getRealmNameById(destinationRealmId) : "Map";
  const isHome = destinationRealmId === realmId;

  // get info about the destination defence
  // const destinationDefence = getDefenceOnPosition(raider.position);

  return (
    <div
      className={clsx(
        `flex flex-col relative p-2 border rounded-md ${
          isSelected ? "border-order-brilliance" : "border-gray-gold"
        } text-xxs text-gray-gold`,
        props.className,
      )}
      onClick={props.onClick}
    >
      <div className="flex absolute w-full -left-[1px] -top-[1px] items-center text-xxs">
        {entityId.toString() && (
          <div
            className={clsx(
              `flex items-center p-1 border text-light-pink rounded-br-md rounded-tl-md border-gray-gold`,
              isTraveling && "!border-orange !text-orange",
              !isTraveling && isHome && "!text-order-brilliance !border-order-brilliance",
              !isTraveling && destinationName && !isHome && "!text-order-giants !border-order-giants",
            )}
          >
            {isTraveling && destinationName && !isHome && "Outgoing"}
            {isTraveling && isHome && "Incoming"}
            {!isTraveling && isHome && "At the base"}
            {!isTraveling && destinationName && !isHome && "Ready for attack"}
          </div>
        )}
        <div className="flex items-center ml-1">
          {isTraveling && destinationName && !isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling to</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                {destinationRealmId?.toString() && (
                  <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                )}
                {destinationName}
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
          {!isTraveling && destinationName && !isHome && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Waiting on</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                {destinationRealmId?.toString() && (
                  <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                )}
                {destinationName}
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
        {!isTraveling && <div className="flex ml-auto italic text-gold mr-1">Idle</div>}
        {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto italic text-light-pink mr-1">
            {formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
        {raider.position && (
          <ShowOnMapButton
            uIPosition={{ ...getUIPositionFromColRow(raider.position.x, raider.position.y), z: 0 }}
          ></ShowOnMapButton>
        )}
      </div>
      <div className="flex flex-col mt-6 space-y-2">
        <div className="flex relative justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex ml-1 text-center">
                <div className="bold mr-1">x{quantity}</div>
                Raiders
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
              {inventoryResources.resources.map(
                (resource) =>
                  resource && (
                    <ResourceCost
                      key={resource.resourceId}
                      type="vertical"
                      color="text-order-brilliance"
                      resourceId={resource.resourceId}
                      amount={divideByPrecision(Number(resource.amount))}
                    />
                  ),
              )}
            </div>
          )}
          {isYours && (
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
              {!isTraveling && !isHome && (
                <Button
                  size="xs"
                  className="ml-auto"
                  isLoading={isLoading}
                  onClick={onReturn}
                  variant="outline"
                  withoutSound
                >
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
              {!isTraveling && !hasResources && (
                <Button
                  size="xs"
                  className="ml-auto"
                  disabled={false}
                  isLoading={isLoading}
                  onClick={onDefend}
                  variant="outline"
                  withoutSound
                >
                  {`Defend`}
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
              {!isTraveling && isHome && !hasMaxHealth && (
                <Button
                  size="xs"
                  className="ml-auto"
                  disabled={false}
                  onClick={() => {
                    setShowHealRaid(true);
                  }}
                  variant="success"
                  withoutSound
                >
                  {`Heal`}
                </Button>
              )}
              {hasResources && isHome && (
                <Button
                  size="xs"
                  className="ml-auto"
                  isLoading={isLoading}
                  disabled={isTraveling}
                  onClick={onOffload}
                  variant={isTraveling ? "danger" : "success"}
                  withoutSound
                >
                  {`Claim`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type ShowOnMapButtonProps = {
  className?: string;
  uIPosition: UIPosition;
};

const ShowOnMapButton = ({ className, uIPosition }: ShowOnMapButtonProps) => {
  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const [color, setColor] = useState("gold");

  const onHover = () => {
    setColor("white");
  };

  const onHoverOut = () => {
    setColor("gold");
  };

  const showOnMap = () => {
    // if location does not have map in it, then set it to map
    if (!location.includes("/map")) {
      setIsLoadingScreenEnabled(true);
      setTimeout(() => {
        setLocation("/map");
        moveCameraToTarget(uIPosition, 0.01);
      }, 100);
    } else {
      moveCameraToTarget(uIPosition);
    }
  };

  return (
    <div className="mr-1 cursor-pointer" onPointerEnter={onHover} onPointerLeave={onHoverOut} onClick={showOnMap}>
      <Map className={clsx(`ml-1 fill-${color}`, className)} />
    </div>
  );
};
