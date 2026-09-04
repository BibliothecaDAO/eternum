import { ContractAddress, StructureType, type ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useOwnedHyperstructuresEntityIds = (): ID[] => {
  const {
    account: { account },
    setup: {
      components: { Structure },
    },
  } = useDojo();

  const hyperstructures = useEntityQuery([
    HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Hyperstructure }),
  ]);

  return hyperstructures.map((hyperstructureEntityId) => {
    const hyperstructure = getComponentValue(Structure, hyperstructureEntityId);
    return hyperstructure!.entity_id;
  });
};

export const useHyperstructureUpdates = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { Hyperstructure },
    },
  } = useDojo();

  const updates = useEntityQuery([
    Has(Hyperstructure),
    HasValue(Hyperstructure, { hyperstructure_id: hyperstructureEntityId }),
  ]);

  return updates.map((updateEntityId) => getComponentValue(Hyperstructure, updateEntityId));
};
