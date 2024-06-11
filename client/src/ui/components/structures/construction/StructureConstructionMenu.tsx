import useUIStore from "@/hooks/store/useUIStore";
import {
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BuildingType,
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  RESOURCE_INFORMATION,
  RESOURCE_INPUTS_SCALED,
  STRUCTURE_COSTS_SCALED,
  StructureType,
  findResourceById,
} from "@bibliothecadao/eternum";

import useRealmStore from "@/hooks/store/useRealmStore";
import React from "react";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BUILDING_COSTS_SCALED } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";
import { StructureCard } from "./StructureCard";

const STRUCTURE_IMAGE_PREFIX = "/images/buildings/thumb/";
export const STRUCTURE_IMAGE_PATHS = {
  [StructureType.Bank]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.Settlement]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.Hyperstructure]: STRUCTURE_IMAGE_PREFIX + "hyperstructure.png",
  [StructureType.Realm]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.ShardsMine]: STRUCTURE_IMAGE_PREFIX + "mine.png",
};

export const StructureConstructionMenu = () => {
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getBalance } = useResourceBalance();

  const buildingTypes = Object.keys(StructureType)
    .filter((key) => isNaN(Number(key)))
    .filter(
      (key) => key !== "None" && key !== "Realm" && key !== "ShardsMine" && key !== "Bank" && key !== "Settlement",
    ) as string[];

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(realmEntityId, resourceCost.resource);
      return balance.balance >= resourceCost.amount * EternumGlobalConfig.resources.resourcePrecision;
    });

  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {buildingTypes.map((structureType, index) => {
        const building = StructureType[structureType as keyof typeof StructureType];
        const cost = STRUCTURE_COSTS_SCALED[building];
        const hasBalance = checkBalance(cost);
        return (
          <StructureCard
            key={index}
            structureId={building}
            onClick={() => {
              if (!hasBalance) {
                return;
              }
              if (previewBuilding && previewBuilding.type === building) {
                setPreviewBuilding(null);
              } else {
                setPreviewBuilding({ type: building });
              }
            }}
            active={previewBuilding !== null && previewBuilding.type === building}
            name={StructureType[building]}
            toolTip={<StructureInfo structureId={building} entityId={realmEntityId} />}
            canBuild={hasBalance}
          />
        );
      })}
    </div>
  );
};

export const ResourceInfo = ({ resourceId, entityId }: { resourceId: number; entityId: bigint | undefined }) => {
  const cost = RESOURCE_INPUTS_SCALED[resourceId];

  const buildingCost = BUILDING_COSTS_SCALED[BuildingType.Resource];

  const population = BUILDING_POPULATION[BuildingType.Resource];

  const capacity = BUILDING_CAPACITY[BuildingType.Resource];

  const information = RESOURCE_INFORMATION[resourceId];

  const { getBalance } = useResourceBalance();

  return (
    <div className="flex flex-col text-gold text-sm p-1 space-y-1">
      <Headline className="py-3"> Building </Headline>

      {population !== 0 && <div className="font-bold">Increases Population: +{population}</div>}

      {capacity !== 0 && <div className=" pt-3 font-bold">Increases Capacity: +{capacity}</div>}

      {findResourceById(resourceId)?.trait && (
        <div className=" flex pt-3 font-bold">
          <div>Produces: +10</div>
          <ResourceIcon className="self-center ml-1" resource={findResourceById(resourceId)?.trait || ""} size="md" />
          {findResourceById(resourceId)?.trait || ""} every cycle
        </div>
      )}

      <div className="pt-3 font-bold">consumed per/s</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(cost).map((resourceId) => {
          const balance = getBalance(entityId || 0n, cost[Number(resourceId)].resource);

          return (
            <ResourceCost
              key={resourceId}
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>

      <div className="pt-3 font-bold">One Time Cost</div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(buildingCost).map((resourceId, index) => {
          const balance = getBalance(entityId || 0n, buildingCost[Number(resourceId)].resource);
          return (
            <ResourceCost
              key={index}
              resourceId={buildingCost[Number(resourceId)].resource}
              amount={buildingCost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>
    </div>
  );
};

export const StructureInfo = ({
  structureId,
  entityId,
  extraButtons = [],
}: {
  structureId: number;
  entityId: bigint | undefined;
  extraButtons?: React.ReactNode[];
}) => {
  const cost = STRUCTURE_COSTS_SCALED[structureId];

  const perTick = structureId == StructureType.Hyperstructure ? `+${HYPERSTRUCTURE_POINTS_PER_CYCLE} points` : "";

  const { getBalance } = useResourceBalance();

  return (
    <div className="p-2 text-sm text-gold">
      <Headline className="pb-3"> {StructureType[structureId]} </Headline>

      {perTick !== "" && (
        <div className=" flex flex-wrap">
          <div className="font-bold uppercase w-full text-xs">Produces </div>
          <div className="flex justify-between">{perTick}/per tick</div>
        </div>
      )}

      <div className="pt-3 font-bold uppercase text-xs"> One time cost</div>
      <div className="grid grid-cols-1 gap-2 text-sm">
        {Object.keys(cost).map((resourceId, index) => {
          const balance = getBalance(entityId || 0n, cost[Number(resourceId)].resource);
          return (
            <ResourceCost
              key={index}
              type="horizontal"
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>
      <div className="flex justify-center">{...extraButtons}</div>
    </div>
  );
};
