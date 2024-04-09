import React, { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { ResourcesIds, findResourceById, getIconResourceId, resources, LABOR_CONFIG } from "@bibliothecadao/eternum";
import { currencyFormat, currencyIntlFormat, divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils.js";
import clsx from "clsx";
import { unpackResources } from "../../../utils/packedData";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { calculateProductivity } from "./labor/laborUtils";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { ReactComponent as MoreIcon } from "@/assets/icons/common/more.svg";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useGetRealm } from "../../../../hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { LevelIndex, useLevel } from "@/hooks/helpers/useLevel";
import { useResourceBalance } from "@/hooks/helpers/useResources";

type RealmResourcesComponentProps = {} & React.ComponentPropsWithRef<"div">;

export const RealmResourcesComponent = ({ className }: RealmResourcesComponentProps) => {
  const [showAllResources, setShowAllResources] = useState<boolean>(false);
  const [realmResourceIds, setRealmResourceIds] = useState<number[]>([]);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { realm } = useGetRealm(realmEntityId);

  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

  useEffect(() => {
    setShowAllResources(false);
  }, [realmEntityId]);

  // unpack the resources
  useMemo((): any => {
    let realmResourceIds: number[] = [ResourcesIds.Lords, ResourcesIds.Wheat, ResourcesIds.Fish];
    let unpackedResources: number[] = [];

    if (realm) {
      unpackedResources = unpackResources(BigInt(realm.resourceTypesPacked), realm.resourceTypesCount);
      realmResourceIds = realmResourceIds.concat(unpackedResources);
      setRealmResourceIds(realmResourceIds);
    }
  }, [realm]);

  const otherResources = useMemo(() => {
    return resources.filter((resource) => !realmResourceIds.includes(resource.id));
  }, [realmResourceIds]);

  const laborResources = [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43];

  if (realmResourceIds.length > 3) {
    return (
      <div className="fixed top-3 left-3 right-3 z-50 !pointer-events-none">
        <div
          className={clsx(
            "relative pointer-events-auto mt-1 rounded-t-xl overflow-hidden text-white bg-black font-bold duration-500 transition-all",
            showAllResources ? "max-h-[100px]" : "max-h-0",
          )}
        >
          <div className=" flex justify-center flex-wrap  w-full p-3">
            {otherResources.map((resource) => (
              <ResourceComponent className="mr-3 mb-1" canFarm={false} key={resource.id} resourceId={resource.id} />
            ))}
            {laborResources.map((resourceId) => (
              <ResourceComponent
                className="mr-3 mb-1"
                isLabor={true}
                canFarm={false}
                key={resourceId}
                resourceId={resourceId}
              />
            ))}
          </div>
        </div>
        <div className={clsx("relative mx-auto w-min bg-black/60 p-3 rounded-b-2xl pointer-events-auto", className)}>
          <div className="relative flex mx-auto space-x-3 overflow-visible text-white font-bold">
            {realmResourceIds.map((resourceId) => (
              <ResourceComponent key={resourceId} resourceId={resourceId} />
            ))}
            <div
              onClick={() => {
                if (realm_level && realm_level > 0) setShowAllResources(!showAllResources);
              }}
              className={clsx("flex items-center ml-4", realm_level == 0 && "blur-sm")}
            >
              <MoreIcon className={clsx("mr-1 duration-300 transition-transform", showAllResources && "rotate-180")} />
              <div className="text-xs  whitespace-nowrap w-16 text-center">
                {showAllResources ? "Minimize" : "Show all"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return <></>;
  }
};

interface ResourceComponentProps {
  isLabor?: boolean;
  resourceId: number;
  canFarm?: boolean;
  className?: string;
}

export const ResourceComponent: React.FC<ResourceComponentProps> = ({
  isLabor = false,
  resourceId,
  className,
  canFarm = true,
}) => {
  const {
    setup: {
      components: { Labor, Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const [productivity, setProductivity] = useState<number>(0);

  const { getEntityLevel, getRealmLevelBonus } = useLevel();
  const { useBalance } = useResourceBalance();

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  const level = getEntityLevel(realmEntityId)?.level || 0;
  // get harvest bonuses
  const [levelBonus, hyperstructureLevelBonus] = useMemo(() => {
    const levelBonus = getRealmLevelBonus(level, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
    return [levelBonus, conqueredHyperstructureNumber * 25 + 100];
  }, [realmEntityId, isFood]);

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  const resource = useBalance(realmEntityId, resourceId);

  useEffect(() => {
    let laborLeft: number = 0;
    if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
      laborLeft = labor.balance - nextBlockTimestamp;
    }
    const productivity =
      // can have a small difference between block timestamp and actual block so make sure that laborLeft is more than 1 minute
      labor && laborLeft > 60
        ? calculateProductivity(
            isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
            labor.multiplier,
            LABOR_CONFIG.base_labor_units,
            levelBonus,
            hyperstructureLevelBonus,
          )
        : 0;
    setProductivity(productivity);
  }, [nextBlockTimestamp, labor]);

  return resource && resource.amount > 0 ? (
    <>
      <div
        onMouseEnter={() =>
          (resourceId >= 23 || level > 0) &&
          setTooltip({
            position: "bottom",
            content: (
              <div className="flex flex-col items-center justify-center">
                <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
                <div>{currencyFormat(resource ? Number(resource.amount) : 0, 2)}</div>
              </div>
            ),
          })
        }
        onMouseLeave={() => setTooltip(null)}
        className={`flex relative group items-center text-sm ${
          resourceId < 23 && level == 0 && "blur-sm"
        } ${className}`}
      >
        <ResourceIcon
          isLabor={isLabor}
          withTooltip={false}
          resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait!}
          size="md"
          className="mr-1"
        />
        <div className="flex text-xs">
          {currencyIntlFormat(
            resource ? (!isLabor ? divideByPrecision(Number(resource.amount)) : Number(resource.amount)) : 0,
            2,
          )}
          {resourceId !== 253 && canFarm && (
            <div
              className={clsx(
                "text-xxs ml-1 rounded-[5px] px-1 w-min ",
                productivity > 0 && "text-order-vitriol bg-dark-green",
                (productivity === 0 || productivity === undefined) && "text-gold bg-brown",
              )}
            >
              {productivity === 0 || productivity === undefined
                ? "IDLE"
                : `${divideByPrecision(productivity).toFixed(0)}/h`}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;
};

export default RealmResourcesComponent;
