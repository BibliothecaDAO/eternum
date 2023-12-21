import React, { useMemo } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { NumberInput } from "../../../../../elements/NumberInput";
import { CombatInfo } from "@bibliothecadao/eternum";

type SelectMergeRaidersProps = {
  selectedRaiders: Record<string, number>;
  attackingRaiders: CombatInfo[];
  setSelectedRaiders: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

export const SelectMergeRaiders = ({
  attackingRaiders,
  selectedRaiders,
  setSelectedRaiders,
}: SelectMergeRaidersProps) => {
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  return (
    <div className={"w-full mt-2 overflow-y-auto max-h-80"}>
      {attackingRaiders
        .filter((raider) => {
          // either the ones that never moved or have arrived
          return raider.arrivalTime === undefined || raider.arrivalTime <= (nextBlockTimestamp || 0);
        })
        .map((raider, i) => (
          <SelectableMergeRaider
            key={i}
            raider={raider}
            selectedRaiders={selectedRaiders}
            setSelectedRaiders={setSelectedRaiders}
          ></SelectableMergeRaider>
        ))}
    </div>
  );
};

type SelectableRaiderProps = {
  raider: CombatInfo;
  selectedRaiders: Record<string, number>;
  setSelectedRaiders: React.Dispatch<React.SetStateAction<Record<string, number>>>;
} & React.HTMLAttributes<HTMLDivElement>;

export const SelectableMergeRaider = ({
  raider,
  selectedRaiders,
  setSelectedRaiders,
  ...props
}: SelectableRaiderProps) => {
  const { entityId, health, quantity, attack, defence, originRealmId, arrivalTime } = raider;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const isTraveling = arrivalTime && nextBlockTimestamp ? arrivalTime > nextBlockTimestamp : false;
  const originRealmName = originRealmId ? getRealmNameById(originRealmId) : undefined;

  const soldierProportion = useMemo(() => {
    return (selectedRaiders[Number(entityId)] || 0) / raider.quantity;
  }, [selectedRaiders[Number(entityId)]]);

  const [totalAttack, totalDefence, totalHealth, totalQuantity] = useMemo(() => {
    return [
      Math.round(attack * (1 - soldierProportion)),
      Math.round(defence * (1 - soldierProportion)),
      Math.round(health * (1 - soldierProportion)),
      Math.round(quantity * (1 - soldierProportion)),
    ];
  }, [soldierProportion]);

  const isDefender = useMemo(() => {
    return raider.sec_per_km === 0;
  }, [raider]);

  return (
    <div
      className={`flex cursor-pointer flex-col p-2 mb-2 bg-black border border-gray-gold transition-all duration-200 rounded-md text-xxs text-gold`}
    >
      <div className="flex items-center text-xxs">
        {entityId.toString() && (
          <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
            #{entityId.toString()}
          </div>
        )}
        <div className="flex items-center ml-1 -mt-2">
          {isTraveling && originRealmId?.toString() && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling from</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {!isTraveling && originRealmId?.toString() && (
            <div className="flex items-center ml-1">
              {/* <span className="italic text-light-pink">Arrived from</span> */}
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
              </div>
            </div>
          )}
        </div>
        {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex flex-col mt-2 space-y-2">
        <div className="flex relative justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex ml-1 text-center">
                <div className="bold mr-1">x{totalQuantity}</div>
                {isDefender ? "Defenders" : "Raiders"}
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
                <div className="bold ">{totalAttack}</div>
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
                <div className="bold ">{totalDefence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-order-brilliance">{totalHealth && totalHealth.toLocaleString()}</div>&nbsp;/{" "}
            {10 * totalQuantity} HP
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
        <div className="flex items-center justify-center">
          <div className="italic text-light-pink">Amount</div>
          <NumberInput
            className="ml-2 mr-2"
            value={selectedRaiders[Number(entityId)] || 0}
            onChange={(value) =>
              setSelectedRaiders((prevSelectedRaiders) => {
                const newSelectedRaiders = { ...prevSelectedRaiders };
                if (value > 0) {
                  newSelectedRaiders[Number(entityId)] = value;
                } else {
                  // delete from object
                  delete newSelectedRaiders[Number(entityId)];
                }
                return newSelectedRaiders;
              })
            }
            min={0}
            max={quantity}
            step={1}
          />
          <div className="italic text-gold">Max {quantity}</div>
        </div>
      </div>
    </div>
  );
};
