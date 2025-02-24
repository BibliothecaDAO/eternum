import { ContractAddress, getStructure } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  // todo: fix filtering
  const entities = useEntityQuery([Has(components.Structure)]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(id, ContractAddress(account.address), components))
      .filter((structure) => structure?.isMine)
      .sort((a, b) => (a?.structure?.base?.category ?? 0) - (b?.structure?.base?.category ?? 0));
  }, [entities]);

  return playerStructures;
};
