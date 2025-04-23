import { ContractAddress, Position, Structure } from "@bibliothecadao/types";
import { getEntityIdFromKeys, getStructure } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([
    HasValue(components.Structure, { owner: playerAddress || ContractAddress(account.address) }),
  ]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(id, ContractAddress(account.address), components))
      .filter((value) => Boolean(value))
      .sort((a, b) => (a?.structure?.base?.category ?? 0) - (b?.structure?.base?.category ?? 0));
  }, [entities]);

  return playerStructures as Structure[];
};

export const usePlayerStructureAtPosition = ({ position }: { position: Position }) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entityAtPosition = useComponentValue(
    components.Tile,
    getEntityIdFromKeys([BigInt(position.x), BigInt(position.y)]),
  );

  const ownStructure = useMemo(() => {
    if (!entityAtPosition || !entityAtPosition.occupier_is_structure) return null;
    const structure = getStructure(entityAtPosition.occupier_id, ContractAddress(account.address), components);
    if (!structure || !structure.isMine) return null;
    return structure;
  }, [entityAtPosition, position.x, position.y]);

  return ownStructure;
};
