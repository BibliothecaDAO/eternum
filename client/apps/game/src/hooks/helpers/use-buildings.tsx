import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/dojo-context";
import { ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ResourceCost, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

export interface Building {
  name: string;
  category: string;
  paused: boolean;
  produced: ResourceCost;
  consumed: ResourceCost[];
  bonusPercent: number;
  innerCol: number;
  innerRow: number;
}

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
        if (!building || !building.produced_resource_type) return;

        const produced = configManager.resourceOutput[building.produced_resource_type];
        const consumed = configManager.resourceInputs[building.produced_resource_type];

        let name = building.category;
        name = name.replace(/([a-z])([A-Z])/g, "$1 $2"); // Add spaces before capital letters (except at the start of the string)

        if (building.category === BuildingType[BuildingType.Resource]) {
          name = ResourcesIds[building.produced_resource_type] + " ";

          if (building.produced_resource_type != ResourcesIds.Dragonhide) {
            name += ResourceIdToMiningType[building.produced_resource_type as ResourcesIds];
          }
          name = name.replace(/_/g, " "); // Replace underscores with spaces
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
