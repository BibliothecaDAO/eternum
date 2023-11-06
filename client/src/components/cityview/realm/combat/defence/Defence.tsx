import React, { useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";

import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as Pen } from "../../../../../assets/icons/common/pen.svg";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { useDojo } from "../../../../../DojoContext";

type IncomingOrderProps = {
  watchTower: CombatInfo;
} & React.HTMLAttributes<HTMLDivElement>;

export const Defence = ({ watchTower, ...props }: IncomingOrderProps) => {
  const { entityId, health, quantity, capacity, attack, defence } = watchTower;

  //   const {
  //     account: { account },
  //     setup: {
  //       systemCalls: { travel },
  //     },
  //   } = useDojo();

  //   const realmId = useRealmStore((state) => state.realmId);
  //   const [isLoading, setIsLoading] = useState(false);

  //   const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs"></div>
      <div className="flex justify-center items-center space-x-2 flex-wrap"></div>
      <div className="flex">
        <div className="flex flex-row">
          <img src={`/images/buildings/watchtower.png`} className="object-cover rounded-[10px] w-[50%]" />
          <div className="flex flex-col w-full h-full mt-2">
            <div className="font-bold text-white text-xs mb-2">City Tower</div>
            {health && (
              <div className="grid grid-cols-12 gap-0.5">
                <ProgressBar containerClassName="col-span-12" rounded progress={(health / (10 * quantity)) * 100} />
              </div>
            )}
            <div className="flex items-center justify-between mt-[8px] text-xxs w-[50%]">
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
                <div className="flex"></div>
                {/* {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
