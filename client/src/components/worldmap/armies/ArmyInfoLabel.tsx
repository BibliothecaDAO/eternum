import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../context/DojoContext";
import { useCombat } from "../../../hooks/helpers/useCombat";
import { ReactComponent as Pen } from "../../../assets/icons/common/pen.svg";
import useUIStore from "../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils";
import { CombatInfo, Resource, UIPosition } from "@bibliothecadao/eternum";
// @ts-ignore
import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import ProgressBar from "../../../elements/ProgressBar";
import { useRealm } from "../../../hooks/helpers/useRealm";
import { useResources } from "../../../hooks/helpers/useResources";
import { ResourceCost } from "../../../elements/ResourceCost";
import { TIME_PER_TICK } from "@bibliothecadao/eternum";

type ArmyInfoLabelProps = {
  position: UIPosition;
  armyId: bigint;
};

export const ArmyInfoLabel = ({ position, armyId }: ArmyInfoLabelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const {
    setup: {
      components: { TickMove },
    },
  } = useDojo();

  const { getResourcesFromInventory } = useResources();
  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const raider = useMemo(() => {
    return getEntitiesCombatInfo([armyId])[0];
  }, [armyId]);

  const tickMove = raider.entityId ? getComponentValue(TickMove, getEntityIdFromKeys([raider.entityId])) : undefined;
  const isPassiveTravel = raider.arrivalTime && nextBlockTimestamp ? raider.arrivalTime > nextBlockTimestamp : false;

  const currentTick = nextBlockTimestamp ? Math.floor(nextBlockTimestamp / TIME_PER_TICK) : 0;
  const isActiveTravel = tickMove !== undefined ? tickMove.tick >= currentTick : false;

  return (
    <Html scale={1} position={[position.x, position.z, -position.y]}>
      <RaiderInfo
        key={raider.entityId}
        raider={raider}
        getRealmAddressName={getRealmAddressName}
        getResourcesFromInventory={getResourcesFromInventory}
        nextBlockTimestamp={nextBlockTimestamp}
        isPassiveTravel={isPassiveTravel}
        isActiveTravel={isActiveTravel}
      />
    </Html>
  );
};

const RaiderInfo = ({
  raider,
  getRealmAddressName,
  getResourcesFromInventory,
  nextBlockTimestamp,
  isPassiveTravel,
  isActiveTravel,
}: {
  raider: CombatInfo;
  getRealmAddressName: (name: bigint) => string;
  getResourcesFromInventory: (entityId: bigint) => { resources: Resource[]; indices: number[] };
  nextBlockTimestamp: number | undefined;
  isPassiveTravel: boolean;
  isActiveTravel: boolean;
}) => {
  const { entityOwnerId, entityId, health, quantity, attack, defence, originRealmId } = raider;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const attackerAddressName = entityOwnerId ? getRealmAddressName(entityOwnerId) : "";

  const originRealmName = originRealmId ? getRealmNameById(originRealmId) : "";

  const inventoryResources = raider.entityId ? getResourcesFromInventory(raider.entityId) : undefined;

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

        <div className="grid grid-cols-12 gap-0.5">
          <ProgressBar
            containerClassName="col-span-12 !bg-order-giants"
            rounded
            progress={(health / (10 * quantity)) * 100}
          />
        </div>

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
        </div>
      </div>
    </div>
  );
};
