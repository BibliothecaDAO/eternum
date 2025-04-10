import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { configManager } from "@bibliothecadao/eternum";
import { BuildingType, BuildingTypeToString } from "@bibliothecadao/types"
import { useMemo } from "react";

export const Buildings = () => {
  const buildingTable = useMemo(() => {
    const buildings = [];

    for (const buildingId of Object.keys(BuildingType) as unknown as BuildingType[]) {
      if (isNaN(Number(buildingId))) continue;

      const complexBuildingCosts = configManager.complexBuildingCosts[buildingId];

      if (complexBuildingCosts.length !== 0) {
        const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(buildingId);
        const population = buildingPopCapacityConfig.population_cost;
        const capacity = buildingPopCapacityConfig.capacity_grant;

        const calldata = {
          building_category: buildingId,
          building_capacity: capacity,
          building_population: population,
          building_resource_type: configManager.getResourceBuildingProduced(buildingId),
          cost_of_building: complexBuildingCosts.map((cost) => {
            return {
              ...cost,
              amount: cost.amount,
            };
          }),
        };

        buildings.push(calldata);
      }
    }

    return buildings;
  }, []);

  return (
    <div className="space-y-8">
      <Headline>Buildings</Headline>

      <section className="space-y-4">
        <h4>Construction Costs</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Every time you build a construction, the cost of the next one grows exponentially.
          </p>
        </div>

        <div className="rounded-lg border border-gold/20 overflow-hidden mt-4">
          <table className="not-prose w-full">
            <thead className="bg-gold/5">
              <tr className="border-b border-gold/20">
                <th className="text-left p-4 text-light-pink">Building</th>
                <th className="text-left p-4 text-light-pink">Population</th>
                <th className="text-left p-4 text-light-pink">One Time Cost</th>
              </tr>
            </thead>
            <tbody>
              {buildingTable.map((building) => (
                <tr
                  key={building.building_category}
                  className="border-b border-gold/10 hover:bg-gold/5 transition-colors"
                >
                  <td className="p-4">
                    <h5 className="mb-2">{BuildingTypeToString[building.building_category]}</h5>
                    <img
                      className="h-32 min-w-20 bg-brown/40 rounded-xl p-2"
                      src={BUILDING_IMAGES_PATH[building.building_category as keyof typeof BUILDING_IMAGES_PATH]}
                      alt={BuildingTypeToString[building.building_category]}
                    />
                  </td>
                  <td className="p-4">
                    {building.building_capacity !== 0 && (
                      <div className="mb-2">
                        <p>Max population capacity:</p>
                        <p className="font-bold">+ {building.building_capacity}</p>
                      </div>
                    )}
                    {building.building_population !== 0 && (
                      <div>
                        <p>Population:</p>
                        <p className="font-bold">+ {building.building_population}</p>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="gap-3 flex flex-col">
                      {building.cost_of_building.map((cost, index) => (
                        <div key={index}>
                          <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
