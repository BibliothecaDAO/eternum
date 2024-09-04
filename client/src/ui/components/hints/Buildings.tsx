import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import {
  BUILDING_CAPACITY,
  BUILDING_COSTS_SCALED,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  BuildingEnumToString,
  BuildingType,
} from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Buildings = () => {
  const buildingTable = useMemo(() => {
    const buildings = [];

    for (const buildingId of Object.keys(BUILDING_RESOURCE_PRODUCED) as unknown as BuildingType[]) {
      if (BUILDING_COSTS_SCALED[buildingId].length !== 0) {
        const population = BUILDING_POPULATION[buildingId];

        const capacity = BUILDING_CAPACITY[buildingId];

        const calldata = {
          building_category: buildingId,
          building_capacity: capacity,
          building_population: population,
          building_resource_type: BUILDING_RESOURCE_PRODUCED[buildingId],
          cost_of_building: BUILDING_COSTS_SCALED[buildingId].map((cost) => {
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

      <table className="not-prose w-full p-2 border-gold/10">
        <thead>
          <tr>
            <th>Building</th>
            <th>Population</th>
            <th>One Time Cost</th>
          </tr>
        </thead>
        <tbody>
          {buildingTable.map((building) => (
            <tr className="border border-gold/10" key={building.building_category}>
              <td className="p-2">
                {" "}
                <h5>{BuildingEnumToString[building.building_category]}</h5>
                <img
                  className="w-24 h-24 border m-1 "
                  src={BUILDING_IMAGES_PATH[building.building_category as keyof typeof BUILDING_IMAGES_PATH]}
                />
              </td>
              <td className="text text-left">
                {building.building_capacity !== 0 && (
                  <>
                    Housing: + {building.building_capacity} <br />
                  </>
                )}
                {building.building_population !== 0 && <>Population: +{building.building_population}</>}
              </td>
              <td className="gap-1 flex flex-col  p-2">
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
