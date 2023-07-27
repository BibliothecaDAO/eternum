import React, { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import {
  ResourcesIds,
  findResourceById,
  resources,
} from "../../../constants/resources";
import { currencyFormat } from "../../../utils/utils.jsx";
import clsx from "clsx";
import { unpackResources } from "../../../utils/packedData";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { calculateProductivity } from "./labor/laborUtils";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { ReactComponent as MoreIcon } from "../../../assets/icons/common/more.svg";
import Button from "../../../elements/Button";
import { SmallResource } from "./SmallResource";
import {
  LaborInterface,
  ResourceInterface,
  useGetRealm,
  useGetRealmLabor,
  useGetRealmResources,
} from "../../../hooks/graphql/useGraphQLQueries";

type RealmResourcesComponentProps = {} & React.ComponentPropsWithRef<"div">;

export const RealmResourcesComponent = ({
  className,
}: RealmResourcesComponentProps) => {
  const [showAllResources, setShowAllResources] = useState<boolean>(false);

  let { realmEntityId } = useRealmStore();

  const { realm } = useGetRealm({ entityId: realmEntityId });
  const { realmLabor } = useGetRealmLabor(realmEntityId);
  const { realmResources } = useGetRealmResources(realmEntityId);

  // unpack the resources
  let realmResourceIds: number[] = [
    ResourcesIds["Wheat"],
    ResourcesIds["Fish"],
  ];
  let unpackedResources: number[] = [];

  // TODO: don't do unpacking at each render but rather in useRealmStore at beginning and store result
  if (realm) {
    unpackedResources = unpackResources(
      BigInt(realm.resource_types_packed),
      realm.resource_types_count,
    );
    realmResourceIds = realmResourceIds.concat(unpackedResources);
  }

  if (realmResourceIds.length > 2) {
    return (
      <div className={clsx("flex h-16 space-x-4", className)}>
        <div className="relative flex mx-auto space-x-2 overflow-visible">
          {realmResourceIds.map((resourceId) => (
            <ResourceComponent
              key={resourceId}
              labor={realmLabor[resourceId]}
              resource={realmResources[resourceId]}
              resourceId={resourceId}
            />
          ))}
          <div
            onClick={() => {
              !showAllResources && setShowAllResources(true);
            }}
            className="absolute flex items-center p-3 text-xs font-bold text-white translate-x-full cursor-pointer -right-2 min-h-10 bg-black/60 rounded-xl"
          >
            {showAllResources ? (
              <div className="flex flex-col">
                <div className="grid grid-cols-4 gap-3">
                  {resources.map((resource) => (
                    <SmallResource resourceId={resource.id}></SmallResource>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-3 !px-3 !py-1 w-min text-xxs"
                  onClick={() => setShowAllResources(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="flex items-center">
                <MoreIcon className="mr-1" />
                {/* // TODO: find a way to get total resource amount */}
                <div className="text-xs">250.49k resourses</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    return <></>;
  }
};

interface ResourceComponentProps {
  resourceId: number;
  labor: LaborInterface | undefined;
  resource: ResourceInterface | undefined;
}

const ResourceComponent: React.FC<ResourceComponentProps> = ({
  resource,
  labor,
  resourceId,
}) => {
  const { nextBlockTimestamp } = useBlockchainStore();
  const [productivity, setProductivity] = useState<number>(0);

  // TODO: use config file
  let laborConfig = {
    base_food_per_cycle: 14000,
    base_labor_units: 7200,
    base_resources_per_cycle: 21,
  };

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  useEffect(() => {
    let laborLeft: number = 0;
    if (
      nextBlockTimestamp &&
      labor &&
      laborConfig &&
      labor.balance > nextBlockTimestamp
    ) {
      let left = labor.balance - nextBlockTimestamp;
      laborLeft = left < laborConfig.base_labor_units ? 0 : left;
    }
    const productivity =
      labor && laborLeft && laborConfig
        ? calculateProductivity(
            isFood
              ? laborConfig.base_food_per_cycle
              : laborConfig.base_resources_per_cycle,
            labor.multiplier,
            laborConfig.base_labor_units,
          )
        : 0;
    setProductivity(productivity);
  }, [nextBlockTimestamp, labor, laborConfig]);

  return (
    <>
      <div className="flex flex-col">
        <div className="flex items-center p-3 text-xs font-bold text-white bg-black/60 rounded-xl h-11">
          <ResourceIcon
            resource={findResourceById(resourceId)?.trait as string}
            size="xs"
            className="mr-1"
          />
          <div className="text-xs">
            {currencyFormat(resource ? resource.amount : 0)}
          </div>
        </div>
        <div
          className={clsx(
            "text-xxs mt-2 rounded-[5px] px-2 h-4 w-min",
            productivity > 0 && "text-order-vitriol bg-dark-green",
            (productivity === 0 || productivity === undefined) &&
              "text-gold bg-brown",
          )}
        >
          {productivity === 0 || productivity === undefined
            ? "IDLE"
            : `${productivity}/h`}
        </div>
      </div>
      {resourceId === ResourcesIds["Fish"] && (
        <div className="flex items-center mx-3 -translate-y-2">|</div>
      )}
    </>
  );
};

export default RealmResourcesComponent;
