import { ClientComponents } from "@/dojo/createClientComponents";
import { configManager } from "@/dojo/setup";
import { DUMMY_HYPERSTRUCTURE_ENTITY_ID } from "@/three/scenes/constants";
import { divideByPrecision, toHexString, toInteger } from "@/ui/utils/utils";
import { ContractAddress, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, ComponentValue, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useCallback, useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { useEntitiesUtils } from "./useEntities";

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
    setup: {
      components: { Structure, Contribution, Position, Owner, EntityName, Hyperstructure },
    },
  } = useDojo();

  const { getAddressNameFromEntity } = useEntitiesUtils();

  const hyperstructures = useEntityQuery([Has(Structure), HasValue(Structure, { category: "Hyperstructure" })]).map(
    (hyperstructureEntityId) => {
      const hyperstructure = getComponentValue(Hyperstructure, hyperstructureEntityId);
      const structure = getComponentValue(Structure, hyperstructureEntityId);
      const position = getComponentValue(Position, hyperstructureEntityId);
      const contributions = hyperstructure ? getContributions(hyperstructure?.entity_id, Contribution) : [];
      const ownerEntityIds = hyperstructure
        ? runQuery([Has(Owner), HasValue(Owner, { entity_id: hyperstructure.entity_id })])
            .values()
            .next().value
        : undefined;

      const ownerComponent = getComponentValue(Owner, ownerEntityIds || ("" as Entity));
      const owner = toHexString(ownerComponent?.address || 0n);
      const isOwner = ContractAddress(ownerComponent?.address ?? 0n) === ContractAddress(account.address);
      const entityName = getComponentValue(EntityName, hyperstructureEntityId);
      const ownerName = hyperstructure ? getAddressNameFromEntity(hyperstructure.entity_id!) : "";

      return {
        ...hyperstructure,
        ...structure,
        ...position,
        ...contributions,
        owner,
        isOwner,
        ownerName,
        entityIdPoseidon: hyperstructureEntityId,
        name: entityName
          ? shortString.decodeShortString(entityName.name.toString())
          : `Hyperstructure ${
              hyperstructure?.entity_id === Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID) ? "" : hyperstructure?.entity_id
            }`,
      };
    },
  );

  return { hyperstructures };
};

export const useGetHyperstructureProgress = () => {
  const {
    setup: {
      components: { Progress },
    },
  } = useDojo();

  return (hyperstructureEntityId: ID) => {
    let progressQueryResult = runQuery([
      Has(Progress),
      HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
    ]);
    let progresses = Array.from(progressQueryResult).map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    const { percentage, allProgresses } = getAllProgressesAndTotalPercentage(progresses, hyperstructureEntityId);
    return { percentage: toInteger(percentage), progresses: allProgresses };
  };
};

export const useHyperstructureProgress = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { Progress },
    },
  } = useDojo();

  let progressQueryResult = useEntityQuery([
    Has(Progress),
    HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);
  return useMemo(() => {
    let progresses = progressQueryResult.map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    const { percentage, allProgresses } = getAllProgressesAndTotalPercentage(progresses, hyperstructureEntityId);
    return { percentage: toInteger(percentage), progresses: allProgresses };
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
    HasValue(Hyperstructure, { entity_id: hyperstructureEntityId }),
  ]);

  return updates.map((updateEntityId) => getComponentValue(Hyperstructure, updateEntityId));
};

interface ContractAddressAndAmount {
  key: false;
  type: "tuple";
  type_name: "(ContractAddress, u16)";
  value: [
    {
      key: false;
      type: "primitive";
      type_name: "ContractAddress";
      value: string;
    },
    {
      key: false;
      type: "primitive";
      type_name: "u16";
      value: number;
    },
  ];
}

export const useGetPlayerEpochs = () => {
  const {
    account: { account },
    setup: {
      components: { Epoch },
    },
  } = useDojo();

  const getEpochs = useCallback(() => {
    const entityIds = runQuery([Has(Epoch)]);
    return Array.from(entityIds)
      .map((entityId) => {
        const epoch = getComponentValue(Epoch, entityId);
        if (
          epoch?.owners.find((arrayElem) => {
            const owner = arrayElem as unknown as ContractAddressAndAmount;
            if (ContractAddress(owner.value[0].value) === ContractAddress(account.address)) {
              return true;
            }
          })
        ) {
          return { hyperstructure_entity_id: epoch?.hyperstructure_entity_id, epoch: epoch?.index };
        }
      })
      .filter((epoch): epoch is { hyperstructure_entity_id: ID; epoch: number } => epoch !== undefined);
  }, [account.address]);

  return getEpochs;
};

const getContributions = (hyperstructureEntityId: ID, Contribution: Component) => {
  const contributions = runQuery([
    Has(Contribution),
    HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);
  return Array.from(contributions).map((contributionEntityId) => getComponentValue(Contribution, contributionEntityId));
};

const getAllProgressesAndTotalPercentage = (
  progresses: (ComponentValue<ClientComponents["Progress"]["schema"]> | undefined)[],
  hyperstructureEntityId: ID,
) => {
  let percentage = 0;
  const allProgresses = configManager
    .getHyperstructureRequiredAmounts(hyperstructureEntityId)
    .map(({ resource, amount: resourceCost }) => {
      let foundProgress = progresses.find((progress) => progress!.resource_type === resource);
      const resourcePercentage = !foundProgress
        ? 0
        : Math.floor((divideByPrecision(Number(foundProgress.amount)) / resourceCost!) * 100);
      let progress = {
        hyperstructure_entity_id: hyperstructureEntityId,
        resource_type: resource,
        amount: !foundProgress ? 0 : divideByPrecision(Number(foundProgress.amount)),
        percentage: resourcePercentage,
        costNeeded: resourceCost,
      };
      percentage += resourcePercentage;
      return progress;
    });
  const totalPercentage = percentage / allProgresses.length;
  return { allProgresses, percentage: totalPercentage };
};
