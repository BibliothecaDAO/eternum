import { useDojo } from "@/hooks/context/DojoContext";
import { toHexString } from "@/ui/utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";

export const useFragmentMines = () => {
  const {
    setup: {
      components: { Structure, Position, Owner, EntityName, Building, Production },
    },
  } = useDojo();

  const fragmentMines = useEntityQuery([Has(Structure), HasValue(Structure, { category: "FragmentMine" })]).map(
    (fragmentMineEntityId) => {
      const fragmentMine = getComponentValue(Structure, fragmentMineEntityId);
      const position = getComponentValue(Position, fragmentMineEntityId);
      const entityName = getComponentValue(EntityName, fragmentMineEntityId);

      const owner = toHexString(
        getComponentValue(Owner, getEntityIdFromKeys([BigInt(fragmentMine!.entity_id)]))?.address || 0n,
      );

      const building = getComponentValue(
        Building,
        runQuery([HasValue(Building, { outer_entity_id: fragmentMine!.entity_id })])
          .values()
          .next().value ?? ("0" as Entity),
      );

      const production = getComponentValue(
        Production,
        runQuery([HasValue(Production, { entity_id: fragmentMine!.entity_id })])
          .values()
          .next().value ?? ("0" as Entity),
      );

      return {
        ...fragmentMine,
        ...position,
        ...building,
        ...production,
        owner,
        name: entityName
          ? shortString.decodeShortString(entityName.name.toString())
          : `FragmentMine ${fragmentMine?.entity_id}`,
      };
    },
  );
  return { fragmentMines };
};
