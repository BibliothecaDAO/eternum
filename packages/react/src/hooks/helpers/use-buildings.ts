import { Building, BuildingEnumToString, configManager, getProducedResource, ResourceIdToMiningType, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../";

export const useBuildings = (outerCol: number, outerRow: number) => {
  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const buildingEntities = useEntityQuery([
    Has(Building),
    HasValue(Building, { outer_col: outerCol, outer_row: outerRow }),
  ]);

  const buildings = useMemo(() => {
    return Array.from(buildingEntities)
      .map((entity) => {
        const building = getComponentValue(Building, entity);
        if (!building) return;
        let produced_resource_type = getProducedResource(building.category);
        if (produced_resource_type == 0 || produced_resource_type == undefined) return;

        const produced = configManager.resourceOutput[produced_resource_type];
        const consumed = configManager.resourceInputs[produced_resource_type];

        let name = BuildingEnumToString[building.category as keyof typeof BuildingEnumToString];
        name = name.replace(/([a-z])([A-Z])/g, "$1 $2"); // Add spaces before capital letters (except at the start of the string)
        let addToName = ResourceIdToMiningType[produced_resource_type as ResourcesIds];
        if (addToName) {
          name += " " + addToName;
        }
        return {
          name,
          category: building.category,
          paused: building.paused,
          produced,
          consumed,
          bonusPercent: building.bonus_percent, //divide here
          innerCol: building.inner_col,
          innerRow: building.inner_row,
        };
      })
      .filter((building) => building != null);
  }, [buildingEntities]);

  return buildings as Building[];
};
