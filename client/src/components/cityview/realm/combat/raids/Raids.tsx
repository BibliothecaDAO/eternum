import React, { useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";

import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
// import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
// import { ResourceCost } from "../../../../../elements/ResourceCost";
// import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
// import { useResources } from "../../../../../hooks/helpers/useResources";
// import { useCaravan } from "../../../../../hooks/helpers/useCaravans";
// import { divideByPrecision } from "../../../../../utils/utils";

type IncomingOrderProps = {
  raider: CombatInfo;
  setShowTravelRaid: (show: boolean) => void;
  setShowAttackRaid: (show: boolean) => void;
  setShowManageRaid: (show: boolean) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const Raid = ({ raider, ...props }: IncomingOrderProps) => {
  const { entityId, health, quantity, capacity, attack, defence } = raider;
  const { setShowAttackRaid, setShowManageRaid, setShowTravelRaid } = props;

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const [isLoading, setIsLoading] = useState(false);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  // const hasArrivedOriginalPosition =
  //   arrivalTime !== undefined && nextBlockTimestamp !== undefined && arrivalTime <= nextBlockTimestamp;

  const isTraveling = false;
  const destinationRealmId = undefined;
  const destinationRealmName = "";
  const hasArrivedPickupPosition = false;

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
          {isTraveling && destinationRealmName && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling {hasArrivedPickupPosition ? "from" : "to"}</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xxs" />
                {destinationRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {capacity && (
            <div className="flex items-center ml-1 text-gold">
              {0}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${capacity / 1000} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
        {true && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {/* {arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(arrivalTime - nextBlockTimestamp)}
          </div>
        )} */}
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
                <DonkeyIcon />
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
              <div className="flex flex-col items-center justify-center">
                <div className="flex">
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
                  <Button
                    className="!px-[6px] !py-[2px] text-xxs ml-auto"
                    disabled={false}
                    onClick={() => {
                      setShowManageRaid(true);
                    }}
                    variant="outline"
                    withoutSound
                  >
                    {`Manage`}
                  </Button>
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
