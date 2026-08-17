import { formatArmies } from "@bibliothecadao/eternum";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
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
