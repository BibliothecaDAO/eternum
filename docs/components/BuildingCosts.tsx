import { BuildingType, EternumGlobalConfig, findResourceById, ResourcesIds } from "@bibliothecadao/eternum";
import ResourceIcon from "./ResourceIcon";
import { formatAmount } from "../utils/formatting";

type Props = {
  buildingType: BuildingType;
};

export default function BuildingCosts({ buildingType }: Props) {
  const costs = EternumGlobalConfig.buildings.buildingCosts[buildingType] || [];
  const resourceCostsWheat = EternumGlobalConfig.resources.resourceBuildingCosts[ResourcesIds.Wood] || [];
  const resourceCostsFish = EternumGlobalConfig.resources.resourceBuildingCosts[ResourcesIds.Stone] || [];

  if (buildingType === BuildingType.Resource) {
    return (
      <div className="my-4 p-3">
        <div className="font-bold mb-2">Building costs:</div>
        <div className="flex flex-row items-center gap-4">
          {resourceCostsWheat.map((cost) => {
            const resource = findResourceById(cost.resource);
            return (
              <div key={cost.resource} className="flex items-center px-2 py-2 rounded-md">
                <ResourceIcon size="lg" id={cost.resource} name={resource?.trait || ""} />
                <div className="flex flex-col">
                  <span>{resource?.trait}</span>
                  <span>{formatAmount(cost.amount)}</span>
                </div>
              </div>
            );
          })}
          <span>or</span>
          {resourceCostsFish.map((cost) => {
            const resource = findResourceById(cost.resource);
            return (
              <div key={cost.resource} className="flex items-center gap-1 px-2 py-1.5 rounded-md">
                <ResourceIcon size="lg" id={cost.resource} name={resource?.trait || ""} />
                <div className="flex flex-col">
                  <span>{resource?.trait}</span>
                  <span>{formatAmount(cost.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!costs || costs.length === 0) return null;

  return (
    <div className="my-4 p-3">
      <div className="font-bold mb-2">Building costs:</div>
      <div className="grid grid-cols-2 gap-2">
        {costs.map((cost) => {
          const resource = findResourceById(cost.resource);
          return (
            <div key={cost.resource} className="flex items-center gap-1 px-2 py-1.5 rounded-md">
              <ResourceIcon size="lg" id={cost.resource} name={resource?.trait || ""} />
              <div className="flex flex-col">
                <span className="font-medium">{resource?.trait}</span>
                <span className="font-medium">{formatAmount(cost.amount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
