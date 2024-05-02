import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";
import { shortString } from "starknet";

const formatArmies = (armies: any[], Army: Component, Name: Component) => {
  return armies.map((id) => {
    const army = getComponentValue(Army, id);
    const name = getComponentValue(Name, id);
    return { ...army, name: name ? shortString.decodeShortString(name.name.toString()) : `Army ${army?.entity_id}` };
  });
};

export const useEntityArmies = ({ entity_id }: { entity_id: bigint }) => {
  const {
    setup: {
      components: { Army, EntityOwner, EntityName },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

  return {
    entityArmies: () => formatArmies(armies, Army, EntityName),
  };
};

export const usePositionArmies = ({ position }: { position: Position }) => {
  {
    const {
      setup: {
        components: { Army, Position, EntityName },
      },
    } = useDojo();

    const armies = useEntityQuery([Has(Army), HasValue(Position, position)]);

    return {
      positionArmies: () => formatArmies(armies, Army, EntityName),
    };
  }
};
