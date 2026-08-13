import { getStructure } from "@bibliothecadao/eternum";
import { ContractAddress, Structure } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
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
      .toSorted((a, b) => {
        // First sort by category
        const categoryDiff = (a?.structure?.base?.category ?? 0) - (b?.structure?.base?.category ?? 0);
        if (categoryDiff !== 0) return categoryDiff;

        // If same category, sort by entity id
        return Number(a?.entityId ?? 0) - Number(b?.entityId ?? 0);
      });
  }, [entities]);

  return playerStructures as Structure[];
};
