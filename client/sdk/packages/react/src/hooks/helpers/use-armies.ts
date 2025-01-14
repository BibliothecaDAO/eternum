import { ArmyInfo, type ID, type Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, Not, NotValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../";
import { formatArmies } from "../utils/army";

export const useArmiesByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([
    Has(components.Army),
    Has(components.Position),
    NotValue(components.Health, { current: 0n }),
    Has(components.Quantity),
    HasValue(components.EntityOwner, { entity_owner_id: structureEntityId }),
  ]);

  const entityArmies = useMemo(() => {
    return formatArmies(armies, account.address, components);
  }, [armies]);

  return {
    entityArmies,
  };
};

export const useArmyByArmyEntityId = (entityId: ID): ArmyInfo | undefined => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  return formatArmies([getEntityIdFromKeys([BigInt(entityId)])], account.address, components)[0];
};

export const useArmiesInBattle = (battle_id: ID) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const armiesEntityIds = runQuery([
    Has(components.Army),
    NotValue(components.Health, { current: 0n }),
    NotValue(components.Army, { battle_id: 0 }),
    HasValue(components.Army, { battle_id }),
  ]);

  const armies = useMemo(() => {
    return formatArmies(Array.from(armiesEntityIds), account.address, components);
  }, [battle_id]);

  return armies;
};

export const useArmiesAtPosition = ({ position }: { position: Position }) => {
  {
    const {
      account: { account },
      setup: { components },
    } = useDojo();

    const armiesAtPosition = useEntityQuery([
      Has(components.Army),
      NotValue(components.Health, { current: 0n }),
      HasValue(components.Position, { x: position.x, y: position.y }),
      Not(components.Protectee),
    ]);

    const ownArmies = useMemo(() => {
      return formatArmies(armiesAtPosition, account.address, components);
    }, [armiesAtPosition, position.x, position.y]);

    return ownArmies;
  }
};

export const useGetArmyByEntityId = () => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const getArmy = (entity_id: ID): ArmyInfo | undefined => {
    return formatArmies([getEntityIdFromKeys([BigInt(entity_id)])], account.address, components)[0];
  };

  return { getArmy };
};
