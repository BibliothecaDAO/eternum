import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";

const formatArmies = (armies: any[], Army: Component) => {
  return armies.map((id) => {
    const army = getComponentValue(Army, id);
    return { ...army, name: `Army ${army?.entity_id}` };
  });
};

export const useEntityArmies = ({ entity_id }: { entity_id: bigint }) => {
  const {
    setup: {
      components: { Army, EntityOwner },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

  return {
    entityArmies: () => formatArmies(armies, Army),
  };
};

export const usePositionArmies = ({ position }: { position: Position }) => {
  {
    const {
      setup: {
        components: { Army, Position },
      },
    } = useDojo();

    const armies = useEntityQuery([Has(Army), HasValue(Position, position)]);

    return {
      positionArmies: () => formatArmies(armies, Army),
    };
  }
};
