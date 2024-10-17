import { configManager } from "@/dojo/setup";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BuildingEnumToString, BuildingType } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Buildings = () => {
  const buildingTable = useMemo(() => {
    const buildings = [];

    for (const buildingId of Object.keys(BuildingType) as unknown as BuildingType[]) {
      if (isNaN(Number(buildingId))) continue;

      const buildingCosts = configManager.buildingCosts[buildingId];

      if (buildingCosts.length !== 0) {
        const buildingPopCapacityConfig = configManager.getBuildingPopConfig(buildingId);
        const population = buildingPopCapacityConfig.population;
        const capacity = buildingPopCapacityConfig.capacity;

        const calldata = {
          building_category: buildingId,
          building_capacity: capacity,
          building_population: population,
          building_resource_type: configManager.getResourceBuildingProduced(buildingId),
          cost_of_building: buildingCosts.map((cost) => {
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
    <div>
      <Headline>Buildings</Headline>
      <div className="mt-2 mb-2 text-2xl">
        Every time you build a construction, the cost of the next one grows exponentially.
      </div>
      <table className="not-prose w-full p-2 border-gold/10 border">
        <thead>
          <tr className="border-b border-gold/10">
            <th className="border-r border-gold/10 p-2">Building</th>
            <th className="border-r border-gold/10 p-2">Population</th>
            <th className="p-2">One Time Cost</th>
          </tr>
        </thead>
        <tbody>
          {buildingTable.map((building) => (
            <tr key={building.building_category} className="border-b border-gold/10">
              <td className="p-2 border-r border-gold/10">
                {" "}
                <h5>{BuildingEnumToString[building.building_category]}</h5>
                <img
                  className="h-32 min-w-20 bg-black/40 rounded-xl m-1 p-2"
                  src={BUILDING_IMAGES_PATH[building.building_category as keyof typeof BUILDING_IMAGES_PATH]}
                />
              </td>
              <td className="text text-center border-r border-gold/10 p-2">
                {building.building_capacity !== 0 && (
                  <>
                    <p>Max population capacity:</p>
                    <p>
                      + {building.building_capacity} <br />
                    </p>
                  </>
                )}
                {building.building_population !== 0 && <>Population: +{building.building_population}</>}
              </td>
              <td className="gap-1 flex flex-col p-2">
                {building.cost_of_building.map((cost, index) => (
                  <div key={index}>
                    <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
