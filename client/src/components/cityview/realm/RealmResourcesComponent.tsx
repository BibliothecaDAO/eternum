import React, { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { ResourcesIds, findResourceById, resources } from "@bibliothecadao/eternum";
import { currencyFormat, currencyIntlFormat, divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils.jsx";
import clsx from "clsx";
import { unpackResources } from "../../../utils/packedData";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { calculateProductivity } from "./labor/laborUtils";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { ReactComponent as MoreIcon } from "../../../assets/icons/common/more.svg";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";
import useUIStore from "../../../hooks/store/useUIStore";
import { LevelIndex, useLevel } from "../../../hooks/helpers/useLevel";

type RealmResourcesComponentProps = {} & React.ComponentPropsWithRef<"div">;

export const RealmResourcesComponent = ({ className }: RealmResourcesComponentProps) => {
  const [showAllResources, setShowAllResources] = useState<boolean>(false);
  const [realmResourceIds, setRealmResourceIds] = useState<number[]>([]);

  let { realmEntityId } = useRealmStore();

  const { realm } = useGetRealm(realmEntityId);

  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

  // unpack the resources
  useMemo((): any => {
    let realmResourceIds: number[] = [ResourcesIds["Lords"], ResourcesIds["Wheat"], ResourcesIds["Fish"]];
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

  if (realmResourceIds.length > 3) {
    return (
      <div
        className={clsx(
          "fixed w-[1000px] top-3 left-1/2 -translate-x-1/2 bg-black/60 p-3 rounded-t-xl rounded-b-2xl",
          className,
        )}
      >
        <div className="relative flex mx-auto space-x-3 overflow-visible text-white font-bold">
          {realmResourceIds.map((resourceId) => (
            <ResourceComponent key={resourceId} resourceId={resourceId} />
          ))}
          <div
            onClick={() => {
              if (realm_level && realm_level > 0) setShowAllResources(!showAllResources);
            }}
            className={clsx("flex items-center !ml-auto", realm_level == 0 && "blur-sm")}
          >
            <MoreIcon className={clsx("mr-1 duration-300 transition-transform", showAllResources && "rotate-180")} />
            <div className="text-xs">{showAllResources ? "Minimize" : "Show all"}</div>
          </div>
        </div>
        <div
          className={clsx(
            "relative flex flex-wrap mt-1 overflow-visible text-white font-bold duration-500 transition-all",
            showAllResources ? "max-h-[100px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {otherResources.map((resource) => (
            <ResourceComponent className="mr-3 mb-1" canFarm={false} key={resource.id} resourceId={resource.id} />
          ))}
        </div>
      </div>
    );
  } else {
    return <></>;
  }
};

interface ResourceComponentProps {
  resourceId: number;
  canFarm?: boolean;
  className?: string;
}

const ResourceComponent: React.FC<ResourceComponentProps> = ({ resourceId, className, canFarm = true }) => {
  const {
    setup: {
      components: { Labor, Resource },
    },
  } = useDojo();

  let { realmEntityId, hyperstructureId } = useRealmStore();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const [productivity, setProductivity] = useState<number>(0);

  const { getEntityLevel, getRealmLevelBonus, getHyperstructureLevelBonus } = useLevel();

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  const level = getEntityLevel(realmEntityId)?.level || 0;
  // get harvest bonuses
  const [levelBonus, hyperstructureLevelBonus] = useMemo(() => {
    const hyperstructureLevel = hyperstructureId ? getEntityLevel(hyperstructureId)?.level || 0 : 0;
    const levelBonus = getRealmLevelBonus(level, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
    const hyperstructureLevelBonus = getHyperstructureLevelBonus(
      hyperstructureLevel,
      isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE,
    );
    return [levelBonus, hyperstructureLevelBonus];
  }, [realmEntityId, isFood]);

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

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

  return (
    <>
      <div
        onMouseEnter={() =>
          (resourceId >= 22 || level > 0) &&
          setTooltip({
            position: "bottom",
            content: (
              <div className="flex flex-col items-center justify-center">
                <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
                <div>{currencyFormat(resource ? resource.balance : 0, 2)}</div>
              </div>
            ),
          })
        }
        onMouseLeave={() => setTooltip(null)}
        className={`flex relative group items-center text-sm ${
          resourceId < 22 && level == 0 && "blur-sm"
        } ${className}`}
      >
        <ResourceIcon
          withTooltip={false}
          resource={findResourceById(resourceId)?.trait as string}
          size="md"
          className="mr-1"
        />
        <div className="flex text-xs">
          {currencyIntlFormat(resource ? resource.balance : 0, 2)}
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
  );
};

export default RealmResourcesComponent;
