import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useCombat } from "../../../../hooks/helpers/useCombat";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import useUIStore from "../../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { getEntityIdFromKeys } from "../../../utils/utils";
import { type CombatInfo, type Resource, type UIPosition } from "@bibliothecadao/eternum";

import { useMemo } from "react";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import ProgressBar from "../../../elements/ProgressBar";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { useResources } from "../../../../hooks/helpers/useResources";
import { HoveringContainer } from "../HoveringContainer";
import { InventoryResources } from "../../resources/InventoryResources";

interface ArmyInfoLabelProps {
  position: UIPosition;
  armyId: bigint;
}

export const ArmyInfoLabel = ({ position, armyId }: ArmyInfoLabelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const {
    setup: {
      components: { TickMove },
    },
  } = useDojo();

  const { getResourcesFromBalance } = useResources();
  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const currentTick = useBlockchainStore((state) => state.currentTick);

  const raider = useMemo(() => {
    return getEntitiesCombatInfo([armyId])[0];
  }, [armyId]);

  const tickMove = raider.entityId ? getComponentValue(TickMove, getEntityIdFromKeys([raider.entityId])) : undefined;
  const isPassiveTravel = raider.arrivalTime && nextBlockTimestamp ? raider.arrivalTime > nextBlockTimestamp : false;

  const isActiveTravel = tickMove !== undefined ? tickMove.tick >= currentTick : false;

  return (
    <HoveringContainer position={[position.x, position.z, -position.y]}>
      <RaiderInfo
        key={raider.entityId}
        raider={raider}
        getRealmAddressName={getRealmAddressName}
        nextBlockTimestamp={nextBlockTimestamp}
        isPassiveTravel={isPassiveTravel}
        isActiveTravel={isActiveTravel}
      />
    </HoveringContainer>
  );
};

const RaiderInfo = ({
  raider,
  getRealmAddressName,
  nextBlockTimestamp,
  isPassiveTravel,
  isActiveTravel,
}: {
  raider: CombatInfo;
  getRealmAddressName: (name: bigint) => string;
  nextBlockTimestamp: number | undefined;
  isPassiveTravel: boolean;
  isActiveTravel: boolean;
}) => {
  const { entityOwnerId, entityId, health, quantity, attack, defence, originRealmId } = raider;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const attackerAddressName = entityOwnerId ? getRealmAddressName(entityOwnerId) : "";

  const originRealmName = originRealmId ? getRealmNameById(originRealmId) : "";

  const isTraveling = isPassiveTravel || isActiveTravel;

  return (
    <div
      className={clsx(
        "w-[300px] flex flex-col p-2 mb-1 bg-black border rounded-md border-gray-gold text-xxs text-gray-gold",
      )}
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
              <span className="italic text-light-pink">From</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
              </div>
            </div>
          )}
          {!isTraveling && originRealmId?.toString() && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Owned by</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <span className={"mr-1"}>{attackerAddressName.slice(0, 10)}</span>
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
              </div>
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
            {isPassiveTravel
              ? formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)
              : "Arrives Next Tick"}
          </div>
        )}
      </div>
      <div className="flex flex-col mt-2 space-y-2">
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
              onMouseEnter={() => {
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{attack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() => {
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
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
        <div className="grid grid-cols-12 gap-0.5">
          <ProgressBar
            containerClassName="col-span-12 !bg-order-giants"
            rounded
            progress={(health / (10 * quantity)) * 100}
          />
        </div>
        <InventoryResources entityId={raider.entityId} />
      </div>
    </div>
  );
};
