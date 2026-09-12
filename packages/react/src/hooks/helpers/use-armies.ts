import { explorersByStructureQuery, readExplorers } from "@bibliothecadao/eternum";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const explorerEntities = useEntityQuery(explorersByStructureQuery(components, structureEntityId));

  return useMemo(
    () => readExplorers(components, explorerEntities, ContractAddress(account.address)),
    [explorerEntities],
  );
};
