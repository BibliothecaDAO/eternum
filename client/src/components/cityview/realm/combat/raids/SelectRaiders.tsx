import React from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { ReactComponent as CaretDownFill } from "../../../../../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as DonkeyIcon } from "../../../../../assets/icons/units/donkey-circle.svg";
import { Dot } from "../../../../../elements/Dot";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import ProgressBar from "../../../../../elements/ProgressBar";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";

type RoadBuildPopupProps = {
  //   toEntityId: number;
  selectedRaiders: CombatInfo[];
  attackingRaiders: CombatInfo[];
  setSelectedRaiders: (raiders: CombatInfo[]) => void;
};

export const SelectRaiders = ({ attackingRaiders, selectedRaiders, setSelectedRaiders }: RoadBuildPopupProps) => {
  return attackingRaiders.map((raider, i) => (
    <SelectableRaider
      key={i}
      raider={raider}
      selectedRaiders={selectedRaiders}
      setSelectedRaiders={setSelectedRaiders}
    ></SelectableRaider>
  ));
};

type SelectableRaiderProps = {
  raider: CombatInfo;
  selectedRaiders: CombatInfo[];
  setSelectedRaiders: (raiders: CombatInfo[]) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const SelectableRaider = ({ raider, selectedRaiders, setSelectedRaiders, ...props }: SelectableRaiderProps) => {
  const { entityId, health, quantity, capacity, attack, defence, originRealmId, arrivalTime } = raider;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const isTraveling = arrivalTime ? arrivalTime > nextBlockTimestamp : false;
  const originRealmName = originRealmId ? getRealmNameById(raider.originRealmId) : undefined;

  return (
    <div
      className={`flex cursor-pointer flex-col p-2 bg-black border border-gray-gold transition-all duration-200 rounded-md ${
        selectedRaiders.map((raider) => raider.entityId).includes(entityId) ? "!border-order-brilliance" : ""
      } text-xxs text-gold`}
      onClick={() => {
        if (!selectedRaiders.map((raider) => raider.entityId).includes(entityId)) {
          // add raider to selected raiders
          setSelectedRaiders([...selectedRaiders, raider]);
        } else {
          // remove raider from selected
          setSelectedRaiders(selectedRaiders.filter((raider) => raider.entityId !== entityId));
        }
      }}
    >
      <div className="flex items-center text-xxs">
        {entityId && (
          <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
            #{entityId}
          </div>
        )}
        <div className="flex items-center ml-1 -mt-2">
          {isTraveling && originRealmId && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling from</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {!isTraveling && originRealmId && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Arrived from</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {capacity && (
            <div className="flex items-center ml-1 text-gold">
              {0}
              <div className="mx-0.5 italic text-light-pink">/</div>
              {`${(capacity * quantity) / 1000} kg`}
              <CaretDownFill className="ml-1 fill-current" />
            </div>
          )}
        </div>
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
                {/* {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
