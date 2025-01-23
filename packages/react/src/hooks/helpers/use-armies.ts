import { ContractAddress, formatArmies, type ID, type Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, Not, NotValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../";

export const useArmiesByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([
    Has(components.Army),
    Has(components.Position),
    HasValue(components.EntityOwner, { entity_owner_id: structureEntityId }),
  ]);

  const entityArmies = useMemo(() => {
    return formatArmies(armies, ContractAddress(account.address), components);
  }, [armies]);

  return {
    entityArmies,
  };
};

export const useArmiesAtPosition = ({ position }: { position: Position }) => {
  {
    const {
      account: { account },
      setup: { components },
    } = useDojo();

    const armiesAtPosition = useEntityQuery([
      Has(components.Army),
      Has(components.Health),
      NotValue(components.Health, { current: 0n }),
      HasValue(components.Position, { x: position.x, y: position.y }),
      Not(components.Protectee),
    ]);

    const ownArmies = useMemo(() => {
      return formatArmies(armiesAtPosition, ContractAddress(account.address), components);
    }, [armiesAtPosition, position.x, position.y]);

    return ownArmies;
  }
};
