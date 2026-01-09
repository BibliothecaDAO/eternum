import {
  formatArmies,
  getEntityIdFromKeys,
  getGuardsByStructure,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "@bibliothecadao/eternum";
import { ContractAddress, ID, type Position } from "@bibliothecadao/types";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([HasValue(components.ExplorerTroops, { owner: structureEntityId })]);

  const explorers = useMemo(() => {
    return formatArmies(armies, ContractAddress(account.address), components);
  }, [armies]);

  return explorers;
};

export const useGuardsByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
  } = useDojo();

  const structure = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));

  const guards = useMemo(() => {
    if (!structure) return [];
    return getGuardsByStructure(structure);
  }, [structure]);

  return guards;
};

export const usePlayerArmyAtPosition = ({ position }: { position: Position }) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entityAtPosition = getTileAt(components, DEFAULT_COORD_ALT, position.x, position.y);

  const ownArmy = useMemo(() => {
    if (!entityAtPosition || entityAtPosition.occupier_is_structure) return null;
    const armies = formatArmies(
      [getEntityIdFromKeys([BigInt(entityAtPosition.occupier_id)])],
      ContractAddress(account.address),
      components,
    );
    return armies.find((army) => army.isMine);
  }, [entityAtPosition, position.x, position.y]);

  return ownArmy;
};
