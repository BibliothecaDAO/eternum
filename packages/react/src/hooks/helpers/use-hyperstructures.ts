import {
  getAddressNameFromEntity,
  getHyperstructureCurrentAmounts,
  getHyperstructureProgress,
  toInteger,
} from "@bibliothecadao/eternum";
import {
  ContractAddress,
  StructureType,
  type HyperstructureInfo,
  type ID,
  type ResourcesIds,
} from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export type ProgressWithPercentage = {
  percentage: number;
  costNeeded: number;
  hyperstructure_entity_id: ID;
  resource_type: ResourcesIds;
  amount: number;
};

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
      position: { x: structure.base.coord_x, y: structure.base.coord_y },
      owner,
      isOwner,
      ownerName,
      access: hyperstructure.access,
    };
  });

  return hyperstructures.filter((h): h is HyperstructureInfo => h !== undefined);
};

export const useHyperstructureProgress = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { HyperstructureRequirements },
      components,
    },
  } = useDojo();

  const progressQueryResult = useEntityQuery([
    HasValue(HyperstructureRequirements, {
      hyperstructure_id: hyperstructureEntityId,
    }),
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

export const useCurrentAmounts = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { HyperstructureRequirements },
      components,
    },
  } = useDojo();

  const currentAmounts = useEntityQuery([
    HasValue(HyperstructureRequirements, {
      hyperstructure_id: hyperstructureEntityId,
    }),
  ]);

  return useMemo(() => {
    return getHyperstructureCurrentAmounts(hyperstructureEntityId, components);
  }, [currentAmounts, hyperstructureEntityId]);
};
