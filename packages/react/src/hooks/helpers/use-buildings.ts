import {
  configManager,
} from "@bibliothecadao/eternum";
import {
  Building,
  BuildingType,
  BuildingTypeToString,
  getProducedResource,
} from "@bibliothecadao/types"
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
        const producedResource = getProducedResource(building?.category as BuildingType);
        if (!building || !producedResource) return;

        const produced = configManager.complexSystemResourceOutput[producedResource];
        const consumed = configManager.complexSystemResourceInputs[producedResource];

        let name = BuildingTypeToString[building.category as keyof typeof BuildingTypeToString];

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
