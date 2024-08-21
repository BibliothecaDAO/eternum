import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";

export const useShardMines = () => {
  const {
    setup: {
      components: { Structure, Position, Owner, EntityName, Building, Production, Resource },
    },
  } = useDojo();

  const shardMines = useEntityQuery([Has(Structure), HasValue(Structure, { category: "FragmentMine" })]).map(
    (shardMineEntityId) => {
      const shardMine = getComponentValue(Structure, shardMineEntityId);
      const position = getComponentValue(Position, shardMineEntityId);
      const entityName = getComponentValue(EntityName, shardMineEntityId);

      const owner = `0x${getComponentValue(
        Owner,
        runQuery([Has(Owner), HasValue(Owner, { entity_id: shardMine!.entity_id })])
          .values()
          .next().value,
      )?.address.toString(16)}`;

      const building = getComponentValue(
        Building,
        runQuery([HasValue(Building, { outer_entity_id: shardMine!.entity_id })])
          .values()
          .next().value,
      );

      const production = getComponentValue(
        Production,
        runQuery([HasValue(Production, { entity_id: shardMine!.entity_id })])
          .values()
          .next().value,
      );

      return {
        ...shardMine,
        ...position,
        ...building,
        ...production,
        owner,
        name: entityName
          ? shortString.decodeShortString(entityName.name.toString())
          : `ShardMine ${shardMine?.entity_id}`,
      };
    },
  );
  return { shardMines };
};
