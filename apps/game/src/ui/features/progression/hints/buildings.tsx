import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Headline, ResourceCost } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";
import { BuildingType, BuildingTypeToString } from "@bibliothecadao/types";
import { useMemo } from "react";

import { ReferenceTable } from "./article";

export const Buildings = () => {
  const buildingTable = useMemo(() => {
    const buildings = [];

    for (const buildingId of configManager.gameBuildings()) {
      const complexBuildingCosts = configManager.getBuildingCosts(buildingId, false)!;

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
        <div className="space-y-4">
          <p className="leading-relaxed">
            Every time you build a construction, the cost of the next one grows exponentially.
          </p>
        </div>

        <ReferenceTable
          label="What each building costs"
          cols="1fr 1fr 2fr"
          head={["Building", "Population", "One Time Cost"]}
          rows={buildingTable.map((building) => ({
            key: building.building_category,
            label: BuildingTypeToString[building.building_category],
            cells: [
              <span key="name" className="flex flex-col gap-2 py-2">
                <h5>{BuildingTypeToString[building.building_category]}</h5>
                <SemanticIcon
                  className="h-32 min-w-20 rounded-xl p-2"
                  name={buildingMeaning(building.building_category)}
                  alt={BuildingTypeToString[building.building_category]}
                />
              </span>,
              <span key="population" className="flex flex-col gap-2">
                {building.building_capacity !== 0 && (
                  <span>
                    Max population capacity: <strong>+ {building.building_capacity}</strong>
                  </span>
                )}
                {building.building_population !== 0 && (
                  <span>
                    Population: <strong>+ {building.building_population}</strong>
                  </span>
                )}
              </span>,
              <span key="cost" className="flex flex-col gap-3">
                {building.cost_of_building.map((cost, index) => (
                  <ResourceCost key={index} resourceId={cost.resource} amount={cost.amount} size="lg" />
                ))}
              </span>,
            ],
          }))}
        />
      </section>
    </div>
  );
};
