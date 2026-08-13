import { DEFAULT_COORD_ALT, getAddressNameFromEntity } from "@bibliothecadao/eternum";
import { ContractAddress, StructureType, type HyperstructureInfo, type ID } from "@bibliothecadao/types";
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

export const useHyperstructures = (): HyperstructureInfo[] => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure, Hyperstructure } = components;

  const hyperstructures = useEntityQuery([Has(Hyperstructure)]).map((hyperstructureEntityId) => {
    const hyperstructure = getComponentValue(Hyperstructure, hyperstructureEntityId);
    const structure = getComponentValue(Structure, hyperstructureEntityId);
    const owner = structure?.owner || 0n;
    const isOwner = ContractAddress(owner) === ContractAddress(account.address);
    const ownerName = hyperstructure ? getAddressNameFromEntity(hyperstructure.hyperstructure_id, components) : "";

    if (!structure || !hyperstructure) return;

    return {
      entity_id: hyperstructure.hyperstructure_id,
      hyperstructure,
      structure,
      position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
      owner,
      isOwner,
      ownerName,
      access: hyperstructure.access,
    };
  });

  return hyperstructures.filter((h): h is HyperstructureInfo => h !== undefined);
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
