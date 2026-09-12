import { readStructures, structuresByOwnerQuery } from "@bibliothecadao/eternum";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const structureEntities = useEntityQuery(
    structuresByOwnerQuery(components, playerAddress || ContractAddress(account.address)),
  );

  return useMemo(
    () => readStructures(components, structureEntities, ContractAddress(account.address)),
    [structureEntities],
  );
};
