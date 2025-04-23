import { StructureType } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "../context";

export const useFragmentMines = () => {
  const {
    setup: {
      components: { Structure, AddressName, Building },
    },
  } = useDojo();

  // todo: fix filtering
  const fragmentMines = useEntityQuery([
    Has(Structure),
    // HasValue(Structure, { base: { category: StructureType.FragmentMine } }),
  ]).map((fragmentMineEntityId) => {
    const fragmentMine = getComponentValue(Structure, fragmentMineEntityId);
    if (!fragmentMine) return;

    if (fragmentMine?.base.category !== StructureType.FragmentMine) return;

    const entityName = getComponentValue(AddressName, fragmentMineEntityId);

    const building = getComponentValue(
      Building,
      runQuery([HasValue(Building, { outer_entity_id: fragmentMine!.entity_id })])
        .values()
        .next().value ?? ("0" as Entity),
    );

    return {
      ...fragmentMine,
      position: { x: fragmentMine.base.coord_x, y: fragmentMine.base.coord_y },
      owner: fragmentMine.owner,
      ...building,
      name: entityName
        ? shortString.decodeShortString(entityName.name.toString())
        : `FragmentMine ${fragmentMine?.entity_id}`,
    };
  });

  return fragmentMines;
};
