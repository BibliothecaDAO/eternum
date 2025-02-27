import { ContractAddress, getStructure, Structure } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([HasValue(components.Structure, { owner: ContractAddress(account.address) })]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(id, ContractAddress(account.address), components))
      .filter((value) => Boolean(value))
      .sort((a, b) => (a?.structure?.base?.category ?? 0) - (b?.structure?.base?.category ?? 0));
  }, [entities]);

  return playerStructures as Structure[];
};
