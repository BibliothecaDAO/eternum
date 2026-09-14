import {
  hyperstructuresByOwnerQuery,
  hyperstructureUpdatesQuery,
  readHyperstructureUpdates,
  readStructureIds,
} from "@bibliothecadao/eternum";
import { ContractAddress, type ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context";

export const useOwnedHyperstructuresEntityIds = (): ID[] => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const hyperstructureEntities = useEntityQuery(
    hyperstructuresByOwnerQuery(components, ContractAddress(account.address)),
  );

  return readStructureIds(components, hyperstructureEntities);
};

export const useHyperstructureUpdates = (hyperstructureEntityId: ID) => {
  const {
    setup: { components },
  } = useDojo();

  const updateEntities = useEntityQuery(hyperstructureUpdatesQuery(components, hyperstructureEntityId));

  return readHyperstructureUpdates(components, updateEntities);
};
