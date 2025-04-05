import {
  ContractAddress,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  getAddressNameFromEntity,
  getHyperstructureProgress,
  ID,
  ResourcesIds,
  toInteger,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context";

export type ProgressWithPercentage = {
  percentage: number;
  costNeeded: number;
  hyperstructure_entity_id: ID;
  resource_type: ResourcesIds;
  amount: number;
};

export const useHyperstructures = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure, AddressName, Hyperstructure } = components;

  const hyperstructures = useEntityQuery([Has(Hyperstructure)]).map((hyperstructureEntityId) => {
    const hyperstructure = getComponentValue(Hyperstructure, hyperstructureEntityId);
    const structure = getComponentValue(Structure, hyperstructureEntityId);
    const owner = structure?.owner || 0n;
    const isOwner = ContractAddress(owner) === ContractAddress(account.address);
    const entityName = getComponentValue(AddressName, hyperstructureEntityId);
    const ownerName = hyperstructure ? getAddressNameFromEntity(hyperstructure.hyperstructure_id, components) : "";

    if (!structure) return;

    return {
      ...hyperstructure,
      ...structure,
      position: { x: structure.base.coord_x, y: structure.base.coord_y },
      owner,
      isOwner,
      ownerName,
      entityIdPoseidon: hyperstructureEntityId,
      name: entityName
        ? shortString.decodeShortString(entityName.name.toString())
        : `Hyperstructure ${
            hyperstructure?.hyperstructure_id === Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID)
              ? ""
              : hyperstructure?.hyperstructure_id
          }`,
    };
  });

  return hyperstructures;
};

export const useHyperstructureProgress = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { HyperstructureRequirements },
      components,
    },
  } = useDojo();

  let progressQueryResult = useEntityQuery([
    HasValue(HyperstructureRequirements, { hyperstructure_id: hyperstructureEntityId }),
  ]);
  return useMemo(() => {
    const { initialized, percentage } = getHyperstructureProgress(hyperstructureEntityId, components);
    return { percentage: toInteger(percentage), initialized };
  }, [progressQueryResult, hyperstructureEntityId]);
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
