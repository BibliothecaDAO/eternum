import { belongsToActiveGame } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";

import type { FaithReadModels } from "./faith-leaderboard-service";

export const useFaithReadModels = (): FaithReadModels => {
  const {
    setup: { components },
  } = useDojo();
  const structureEntities = useEntityQuery([Has(components.Structure)]);
  const wonderFaithEntities = useEntityQuery([Has(components.WonderFaith)]);
  const faithfulStructureEntities = useEntityQuery([Has(components.FaithfulStructure)]);
  const addressNameEntities = useEntityQuery([Has(components.AddressName)]);

  return useMemo(
    () => ({
      structures: structureEntities
        .map((entity) => getComponentValue(components.Structure, entity))
        .filter((row): row is NonNullable<typeof row> => Boolean(row && belongsToActiveGame(row))),
      wonderFaith: wonderFaithEntities
        .map((entity) => getComponentValue(components.WonderFaith, entity))
        .filter((row): row is NonNullable<typeof row> => Boolean(row && belongsToActiveGame(row))),
      faithfulStructures: faithfulStructureEntities
        .map((entity) => getComponentValue(components.FaithfulStructure, entity))
        .filter((row): row is NonNullable<typeof row> => Boolean(row && belongsToActiveGame(row))),
      addressNames: addressNameEntities
        .map((entity) => getComponentValue(components.AddressName, entity))
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    }),
    [addressNameEntities, components, faithfulStructureEntities, structureEntities, wonderFaithEntities],
  );
};
