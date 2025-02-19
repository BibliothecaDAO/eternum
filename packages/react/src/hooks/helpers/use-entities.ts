import { ContractAddress, getStructure, Structure } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([
    Has(components.Structure),
    Has(components.Position),
    Has(components.Owner),
    HasValue(components.Owner, { address: playerAddress || ContractAddress(account.address) }),
  ]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(id, ContractAddress(account.address), components))
      .filter((structure): structure is Structure => structure !== undefined)
      .sort((a, b) => a.structure.category.localeCompare(b.structure.category));
  }, [entities]);

  return playerStructures;
};
