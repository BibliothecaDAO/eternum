import React, { useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";

import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as PremiumIcon } from "../../../../../assets/icons/units/premium.svg";
import { ReactComponent as Shield } from "../../../../../assets/icons/units/shield.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { useDojo } from "../../../../../DojoContext";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { getTotalResourceWeight } from "../../trade/TradeUtils";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";
import { divideByPrecision } from "../../../../../utils/utils";
import { ResourceCost } from "../../../../../elements/ResourceCost";

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

  const { getDefenceOnPosition } = useCombat();
  const { getResourcesFromInventory, offloadChest } = useResources();
  const { getInventoryResourcesChestId } = useCaravan();

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

  const destinationDefence = getDefenceOnPosition(raider.position);

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs">
        {entityId && (
          <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
            #{entityId}
          </div>
        )}
        <div className="flex items-center ml-1 -mt-2">
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
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex justify-center items-center space-x-2 flex-wrap mt-2"></div>
      <div className="flex mt-2">
        <div className="grid w-full grid-cols-1 gap-5">
          <div className="flex flex-col">
            {health && (
              <div className="grid grid-cols-12 gap-0.5">
                <ProgressBar containerClassName="col-span-12" rounded progress={(health / (10 * quantity)) * 100} />
              </div>
            )}
            <div className="flex items-center justify-between mt-[8px] text-xxs">
              <div className="flex flex-rows">
                <PremiumIcon />
                <div className="flex items-center space-x-[6px] ml-2">
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-green" />
                    <div className="mt-1 text-green">{quantity}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-yellow" />
                    <div className="mt-1 text-dark">{0}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-orange" />
                    <div className="mt-1 text-orange">{attack}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-red" />
                    <div className="mt-1 text-red">{defence}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-light-pink" />
                    <div className="mt-1 text-dark">{0}</div>
                  </div>
                </div>
              </div>
              {!isHome && destinationDefence && (
                <div className="flex flex-rows">
                  <Shield className="text-gold mt-1" />
                  <div className="flex items-center space-x-[6px] ml-2">
                    <div className="flex flex-col items-center">
                      <Dot colorClass="bg-green" />
                      <div className="mt-1 text-green">{destinationDefence.quantity}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <Dot colorClass="bg-yellow" />
                      <div className="mt-1 text-dark">{0}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <Dot colorClass="bg-orange" />
                      <div className="mt-1 text-orange">{destinationDefence.attack}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <Dot colorClass="bg-red" />
                      <div className="mt-1 text-red">{destinationDefence.defence}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <Dot colorClass="bg-light-pink" />
                      <div className="mt-1 text-dark">{0}</div>
                    </div>
                  </div>
                </div>
              )}
              {inventoryResources && (
                <div className="flex justify-center items-center space-x-2 flex-wrap">
                  {inventoryResources.map(
                    (resource) =>
                      resource && (
                        <ResourceCost
                          key={resource.resourceId}
                          type="vertical"
                          color="text-order-brilliance"
                          className="!w-5 mt-0.5"
                          resourceId={resource.resourceId}
                          amount={divideByPrecision(resource.amount)}
                        />
                      ),
                  )}
                </div>
              )}
              <div className="flex flex-col items-center justify-center">
                <div className="flex">
                  {!hasResources && !isTraveling && isHome && (
                    <Button
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
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
                    <Button
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                      onClick={onReturn}
                      variant="outline"
                      withoutSound
                    >
                      {`Return`}
                    </Button>
                  )}
                  {!isTraveling && !isHome && isLoading && (
                    <Button
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                      onClick={() => {}}
                      isLoading={true}
                      variant="outline"
                      withoutSound
                    >
                      {`Return`}
                    </Button>
                  )}
                  {!isTraveling && !isHome && !isLoading && (
                    <Button
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
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
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
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
                      className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                      disabled={isTraveling}
                      onClick={onOffload}
                      variant={isTraveling ? "danger" : "success"}
                      withoutSound
                    >
                      {`Claim`}
                    </Button>
                  )}
                </div>
                {/* {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
