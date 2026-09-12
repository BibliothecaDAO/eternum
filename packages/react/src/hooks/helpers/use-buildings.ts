import { buildingsAtQuery, readBuildings } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../";

export const useBuildings = (outerCol: number, outerRow: number) => {
  const {
    setup: { components },
  } = useDojo();

  const buildingEntities = useEntityQuery(buildingsAtQuery(components, outerCol, outerRow));

  return useMemo(() => readBuildings(components, buildingEntities), [buildingEntities]);
};
