import { ContractAddress, formatArmies, getEntityIdFromKeys, OccupiedBy, type Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../";

export const useArmiesByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([HasValue(components.ExplorerTroops, { owner: structureEntityId })]);

  const entityArmies = useMemo(() => {
    return formatArmies(armies, ContractAddress(account.address), components);
  }, [armies]);

  return {
    entityArmies,
  };
};

export const usePlayerArmyAtPosition = ({ position }: { position: Position }) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entityAtPosition = useComponentValue(
    components.Occupied,
    getEntityIdFromKeys([BigInt(position.x), BigInt(position.y)]),
  );

  const ownArmy = useMemo(() => {
    if (!entityAtPosition || entityAtPosition.by_type !== OccupiedBy.Explorer) return null;
    const armies = formatArmies(
      [getEntityIdFromKeys([BigInt(entityAtPosition.by_id)])],
      ContractAddress(account.address),
      components,
    );
    return armies.find((army) => army.isMine);
  }, [entityAtPosition, position.x, position.y]);

  return ownArmy;
};
