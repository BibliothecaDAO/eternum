import {
  ContractAddress,
  formatArmies,
  getEntityIdFromKeys,
  ID,
  OccupiedBy,
  type Position,
} from "@bibliothecadao/eternum";
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
    if (!structure?.troop_guards) return [];

    // Extract guard troops from the structure
    const guards = [
      {
        slot: 0,
        troops: structure.troop_guards.delta,
        destroyedTick: structure.troop_guards.delta_destroyed_tick,
      },
      {
        slot: 1,
        troops: structure.troop_guards.charlie,
        destroyedTick: structure.troop_guards.charlie_destroyed_tick,
      },
      {
        slot: 2,
        troops: structure.troop_guards.bravo,
        destroyedTick: structure.troop_guards.bravo_destroyed_tick,
      },
      {
        slot: 3,
        troops: structure.troop_guards.alpha,
        destroyedTick: structure.troop_guards.alpha_destroyed_tick,
      },
    ];

    // Filter out guards with no troops
    return guards.filter((guard) => guard.troops.count > 0n);
  }, [structure]);

  return guards;
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
