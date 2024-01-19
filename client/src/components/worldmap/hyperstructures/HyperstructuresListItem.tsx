import { OrderIcon } from "../../../elements/OrderIcon";
import Button from "../../../elements/Button";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { HyperStructureInterface, UIPosition, findResourceById, orderNameDict, orders } from "@bibliothecadao/eternum";
import useUIStore from "../../../hooks/store/useUIStore";
import ProgressBar from "../../../elements/ProgressBar";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import { ReactComponent as DonkeyIcon } from "../../../assets/icons/units/donkey-circle.svg";
import { ReactComponent as Shield } from "../../../assets/icons/units/shield.svg";
import { Dot } from "../../../elements/Dot";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useDojo } from "../../../DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { useCombat } from "../../../hooks/helpers/useCombat";
import { ResourceIcon } from "../../../elements/ResourceIcon";

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
      systemCalls: {},
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

  const enemyRaidersIds = hyperstructure
    ? useEnemyRaidersOnPosition(BigInt(account.address), hyperstructure.position)
    : [];
  const myRaidersIds = hyperstructure
    ? useOwnerRaidersOnPosition(BigInt(account.address), hyperstructure.position)
    : [];

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex w-full justify-between items-center">
        {orderNameDict[order] ? (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {<OrderIcon order={orderNameDict[order]} size="xs" className="mr-1" />}
            {orders[order - 1].fullOrderName}
          </div>
        ) : (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            Not Conquered
          </div>
        )}
        <div className={clsx("flex items-center justify-around ml-3 flex-1 -mt-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            {hyperstructure &&
              hyperstructure.hyperstructureResources.map((resource) => (
                <div className="flex flex-row items-center  my-0.5" key={resource.resourceId}>
                  <div> {resource.currentAmount / resource.completeAmount}%</div>
                  <ResourceIcon
                    resource={findResourceById(resource.resourceId)?.trait as any}
                    size="md"
                    className="mb-1"
                  />
                </div>
              ))}
          </div>
        </div>
        {hyperstructure && (
          <div className=" text-gold flex">
            <Button
              onClick={() => {
                moveCameraToTarget(coords as any);
              }}
              variant="outline"
              className="p-1 !h-4 text-xxs !rounded-md"
            >
              <Map className="mr-1 fill-current" />
              <div className="flex-none w-8 text-right">{`${hyperstructure.distance.toFixed(0)} kms`}</div>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col w-full mt-3">
        {hyperstructure && (
          <div className="flex flex-row w-full mb-2 justify-between">
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
            {hyperstructure && (
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
                    <div className="bold ">{hyperstructure.attack}</div>
                  </div>
                </div>
                <div
                  className="flex items-center h-4 mr-2"
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
                <div className="flex items-center">
                  <div className="text-order-brilliance">
                    {(hyperstructure.health * hyperstructure.watchTowerQuantity) / 100}% HP
                  </div>
                </div>
              </div>
            )}
            <div
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">{`You have ${myRaidersIds.length} armies arrived or headed for this hyperstructure`}</p>
                      <p className="whitespace-nowrap">{`Other realms have ${
                        enemyRaidersIds.length - myRaidersIds.length
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
                  <div className="mt-1 text-orange">{enemyRaidersIds.length}</div>
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
