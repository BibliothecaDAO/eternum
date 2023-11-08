import React from "react";
import clsx from "clsx";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";

type IncomingOrderProps = {
  watchTower: CombatInfo;
} & React.HTMLAttributes<HTMLDivElement>;

export const Defence = ({ watchTower, ...props }: IncomingOrderProps) => {
  const { health, quantity, attack, defence } = watchTower;

  return (
    <div
      className={clsx("flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold", props.className)}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs"></div>
      <div className="flex justify-center items-center flex-wrap"></div>
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
                    <div className="mt-1 text-green">{quantity || 0}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-yellow" />
                    <div className="mt-1 text-dark">{0}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-orange" />
                    <div className="mt-1 text-orange">{attack || 0}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-red" />
                    <div className="mt-1 text-red">{defence || 0}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Dot colorClass="bg-light-pink" />
                    <div className="mt-1 text-dark">{0}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="flex"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
