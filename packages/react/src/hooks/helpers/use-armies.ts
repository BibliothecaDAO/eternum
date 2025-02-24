import { ContractAddress, formatArmies, type ID, type Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
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

  const armiesAtPosition = useEntityQuery([
    HasValue(components.ExplorerTroops, { coord: { x: position.x, y: position.y } }),
  ]);

  const ownArmy = useMemo(() => {
    const armies = formatArmies(armiesAtPosition, ContractAddress(account.address), components);
    return armies.find((army) => army.isMine);
  }, [armiesAtPosition, position.x, position.y]);

  return ownArmy;
};
