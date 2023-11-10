import React from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";

import clsx from "clsx";
import { getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import Button from "../../../../../elements/Button";
import { getResourceCost } from "../../../../../utils/combat";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { divideByPrecision } from "../../../../../utils/utils";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { findResourceById } from "@bibliothecadao/eternum";

type BattalionProps = {
  battalion: CombatInfo;
  onBuild: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const Battalion = ({ battalion, onBuild, ...props }: BattalionProps) => {
  const { health, quantity, capacity, attack, defence } = battalion;
  const setTooltip = useUIStore((state) => state.setTooltip);
  const isTraveling = false;
  const destinationRealmId = undefined;
  const destinationRealmName = "";
  const hasArrivedPickupPosition = false;

  const costPerUnit = getResourceCost(1);

  return (
    <div
      className={clsx(
        "flex flex-col relative border rounded-md border-gray-gold text-xxs text-gray-gold",
        props.className,
      )}
      onClick={props.onClick}
    >
      <div className="flex items-center absolute top-0 left-0 right-0 text-xxs">
        <div className="flex items-center py-[1px] px-[6px] italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold bg-black/60">
          Battalions
        </div>
        <div className="flex items-center ml-1">
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
        </div>
      </div>
      <div className="flex h-full">
        <img src={`/images/units/troop.png`} className="object-cover w-16 rounded-md" />
        <div className="flex flex-1 flex-col p-2 text-xxs h-full">
          <div className="flex justify-between items-center">
            <div className="flex">
              <div
                className="flex items-center h-6 mr-2"
                onMouseEnter={() =>
                  setTooltip({
                    position: "top",
                    content: (
                      <>
                        <p className="whitespace-nowrap">Number of available units</p>
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <img src="/images/units/troop-icon.png" className="h-[28px]" />
                <div className="flex flex-col ml-1 text-center">
                  <div className="bold text-order-brilliance">x{quantity}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center">
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
              <Button onClick={onBuild} size="xs" variant="outline">
                Build More
              </Button>
            </div>
          </div>
          <div
            className="flex space-x-2 mt-2 ml-1 w-min"
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Cost per unit</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
          >
            {costPerUnit.map((cost, index) => (
              <div className="flex text-lightest mt-2">
                <ResourceIcon resource={findResourceById(cost.resourceId).trait} size="xs" className="mr-1" />
                {divideByPrecision(cost.amount).toLocaleString("en-US")}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
