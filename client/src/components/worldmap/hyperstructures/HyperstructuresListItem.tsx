import { OrderIcon } from "../../../elements/OrderIcon";
import Button from "../../../elements/Button";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { HyperStructureInterface, UIPosition, orderNameDict, orders } from "@bibliothecadao/eternum";
import useUIStore from "../../../hooks/store/useUIStore";
import ProgressBar from "../../../elements/ProgressBar";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import { ReactComponent as DonkeyIcon } from "../../../assets/icons/units/donkey-circle.svg";
import { ReactComponent as Shield } from "../../../assets/icons/units/shield.svg";
import { Dot } from "../../../elements/Dot";
import clsx from "clsx";
import { LevelingBonusIcons } from "../../cityview/realm/leveling/Leveling";
import { useMemo, useState } from "react";
import { LevelIndex, useLevel } from "../../../hooks/helpers/useLevel";
import { useDojo } from "../../../DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { getRealm } from "../../../utils/realms";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { ConqueredHyperstructures } from "./ConqueredHyperstructures";
import { useCombat } from "../../../hooks/helpers/useCombat";

type HyperstructuresListItemProps = {
  hyperstructure: HyperStructureInterface | undefined;
  order: number;
  coords: UIPosition | undefined;
  onFeed?: () => void;
};

export const HyperstructuresListItem = ({
  hyperstructure,
  order,
  coords,
  onFeed = undefined,
}: HyperstructuresListItemProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { level_up_hyperstructure },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const setHyperstructures = useUIStore((state) => state.setHyperstructures);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { getHyperstructure } = useHyperstructure();
  const { calculateDistance, useGetPositionCaravansIds } = useCaravan();
  const { useOwnerRaidersOnPosition, useEnemyRaidersOnPosition } = useCombat();

  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const [isLoading, setIsLoading] = useState(false);

  const updateHyperStructure = () => {
    if (!hyperstructure) return;
    const newHyperstructure = getHyperstructure(hyperstructure.uiPosition);
    hyperstructures[hyperstructure.orderId - 1] = newHyperstructure;
    setHyperstructures([...hyperstructures]);
  };

  const canComplete = hyperstructure?.progress === 100;

  const onComplete = async () => {
    setIsLoading(true);
    if (!hyperstructure) return;
    // await complete_hyperstructure({
    //   signer: account,
    //   hyperstructure_id: hyperstructure.hyperstructureId,
    // });
    updateHyperStructure();
    setIsLoading(false);
  };

  const isYoursAndCompleted = hyperstructure?.orderId === order && hyperstructure?.completed;

  const distanceWithRealm = useMemo(() => {
    if (realmEntityIds?.length > 0 && hyperstructure) {
      let realmEntityId = realmEntityIds[0].realmId;
      return calculateDistance(realmEntityId, hyperstructure.hyperstructureId) || 0;
    } else {
      return 0;
    }
  }, [realmEntityIds]);

  const bonusList = useMemo(() => {
    if (!hyperstructure) return [];
    return [
      {
        bonusType: LevelIndex.FOOD,
        bonusAmount: isYoursAndCompleted ? 125 : 100,
      },
      {
        bonusType: LevelIndex.RESOURCE,
        bonusAmount: isYoursAndCompleted ? 125 : 100,
      },
      {
        bonusType: LevelIndex.TRAVEL,
        bonusAmount: isYoursAndCompleted ? 125 : 100,
      },
      {
        bonusType: LevelIndex.COMBAT,
        bonusAmount: isYoursAndCompleted ? 125 : 100,
      },
    ];
  }, [hyperstructure]);

  const caravanIds = hyperstructure
    ? useGetPositionCaravansIds(hyperstructure.position.x, hyperstructure.position.y)
    : [];

  // sum the number of caravans that are mine versus others
  const myCaravans = useMemo(
    () =>
      caravanIds.reduce((acc, curr) => {
        if (curr.isMine) {
          return acc + 1;
        } else {
          return acc;
        }
      }, 0),
    [caravanIds],
  );

  const ennemyRaidersIds = hyperstructure ? useEnemyRaidersOnPosition(hyperstructure.position) : [];
  const myRaidersIds = hyperstructure
    ? useOwnerRaidersOnPosition(BigInt(account.address), hyperstructure.position)
    : [];

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          {<OrderIcon order={orderNameDict[order]} size="xs" className="mr-1" />}
          {orders[order - 1].fullOrderName}
        </div>
        {hyperstructure && (
          <div className="flex relative justify-between text-xxs text-lightest w-full">
            <div className="flex items-center">
              <div className="flex items-center h-6 mr-2">
                <img src="/images/units/troop-icon.png" className="h-[28px]" />
                <div className="flex ml-1 text-center">
                  <div className="bold mr-1">x{hyperstructure.watchTowerQuantity}</div>
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
                  <div className="bold ">{hyperstructure.attack}</div>
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
                  <div className="bold ">{hyperstructure.defence}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="text-order-brilliance">
                {hyperstructure.health && hyperstructure.health.toLocaleString()}
              </div>
              &nbsp;/ {10 * hyperstructure.watchTowerQuantity} HP
            </div>
          </div>
        )}
        <div className=" text-gold flex ml-auto">
          <LevelingBonusIcons
            className="flex flex-row mr-2 items-center justify-center !text-xxs"
            bonuses={bonusList}
          ></LevelingBonusIcons>
          <Button
            onClick={() => {
              moveCameraToTarget(coords as any);
            }}
            variant="outline"
            className="p-1 !h-4 text-xxs !rounded-md"
          >
            <div className="flex-none w-16 text-right">{`${distanceWithRealm.toFixed(0)} km`}</div>
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div>
      </div>
      <ConqueredHyperstructures className={"mt-2"} entityId={hyperstructure?.hyperstructureId} />
      <div className="flex flex-col w-full mt-3">
        {hyperstructure && (
          <div className="flex flex-row w-full justify-between">
            <div
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">{`You have ${myCaravans} caravans arrived or headed for this bank`}</p>
                      <p className="whitespace-nowrap">{`Other realms have ${
                        caravanIds.length - myCaravans
                      } caravans arrived or headed for this bank`}</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="flex items-center justify-between mt-[6px] text-xxs"
            >
              <DonkeyIcon />
              <div className="flex items-center ml-2 space-x-[6px]">
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-green" />
                  <div className="mt-1 text-green">{myCaravans}</div>
                </div>
                <div className="flex flex-col items-center ml-2">
                  <Dot colorClass="bg-orange" />
                  <div className="mt-1 text-orange">{caravanIds.length - myCaravans}</div>
                </div>
              </div>
            </div>
            <div
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">{`You have ${myRaidersIds.length} armies arrived or headed for this hyperstructure`}</p>
                      <p className="whitespace-nowrap">{`Other realms have ${
                        ennemyRaidersIds.length - myRaidersIds.length
                      } caravans arrived or headed for this hyperstructure`}</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="flex items-center justify-between mt-[6px] text-xxs"
            >
              <Shield />
              <div className="flex items-center ml-2 space-x-[6px]">
                <div className="flex flex-col items-center">
                  <Dot colorClass="bg-green" />
                  <div className="mt-1 text-green">{myRaidersIds.length}</div>
                </div>
                <div className="flex flex-col items-center ml-2">
                  <Dot colorClass="bg-orange" />
                  <div className="mt-1 text-orange">{ennemyRaidersIds.length - myRaidersIds.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        <ProgressBar rounded progress={hyperstructure?.progress || 0} className="bg-white" />
        <div className="flex items-center mt-2">
          <div
            className={clsx(
              "ml-1 italic ",
              hyperstructure?.completed && "text-order-brilliance",
              hyperstructure && hyperstructure?.progress >= 0 && !hyperstructure?.completed ? "text-gold" : "",
            )}
          >
            {hyperstructure?.completed ? "Completed" : `Building in progress ${hyperstructure?.progress.toFixed(2)}%`}
          </div>

          <div className="text-xxs ml-auto">
            {order === hyperstructure?.orderId && (
              <Button
                isLoading={isLoading}
                disabled={!canComplete}
                className="!px-[6px] !py-[2px] mr-2"
                variant="success"
                onClick={onComplete}
              >
                Complete
              </Button>
            )}
            {onFeed && (
              <Button className="!px-[6px] !py-[2px]" variant="outline" onClick={onFeed}>
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
