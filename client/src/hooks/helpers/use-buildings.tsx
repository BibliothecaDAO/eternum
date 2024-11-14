import { configManager } from "@/dojo/setup";
import { ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ResourceCost, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

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

export const useBuildings = () => {
  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const getBuildings = (outerCol: number, outerRow: number): Building[] => {
    const buildingEntities = runQuery([
      Has(Building),
      HasValue(Building, { outer_col: outerCol, outer_row: outerRow }),
    ]);

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
  };

  return { getBuildings };
};
