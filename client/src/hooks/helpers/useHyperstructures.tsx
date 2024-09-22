import { ClientComponents } from "@/dojo/createClientComponents";
import { TOTAL_CONTRIBUTABLE_AMOUNT } from "@/dojo/modelManager/utils/LeaderboardUtils";
import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  HyperstructureResourceMultipliers,
  ID,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, ComponentValue, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { toInteger } from "lodash";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { toHexString } from "@/ui/utils/utils";

export type ProgressWithPercentage = {
  percentage: number;
  costNeeded: number;
  hyperstructure_entity_id: ID;
  resource_type: ResourcesIds;
  amount: number;
};

type Progress = {
  percentage: number;
  progresses: ProgressWithPercentage[];
};

export const useHyperstructures = () => {
  const {
    setup: {
      components: { Structure, Contribution, Progress, Position, Owner, EntityName },
    },
  } = useDojo();

  const hyperstructures = useEntityQuery([Has(Structure), HasValue(Structure, { category: "Hyperstructure" })]).map(
    (hyperstructureEntityId) => {
      const hyperstructure = getComponentValue(Structure, hyperstructureEntityId);
      const position = getComponentValue(Position, hyperstructureEntityId);
      const contributions = getContributions(hyperstructure!.entity_id, Contribution);
      const ownerEntityIds = runQuery([Has(Owner), HasValue(Owner, { entity_id: hyperstructure!.entity_id })])
        .values()
        .next().value;

      const owner = toHexString(getComponentValue(Owner, ownerEntityIds || ("" as Entity))?.address || 0n);
      const entityName = getComponentValue(EntityName, hyperstructureEntityId);
      return {
        ...hyperstructure,
        ...position,
        ...contributions,
        owner,
        entityIdPoseidon: hyperstructureEntityId,
        name: entityName
          ? shortString.decodeShortString(entityName.name.toString())
          : `Hyperstructure ${hyperstructure?.entity_id}`,
      };
    },
  );

  const useProgress = (hyperstructureEntityId: ID): Progress => {
    let progressQueryResult = useEntityQuery([
      Has(Progress),
      HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
    ]);
    let progresses = progressQueryResult.map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    const { percentage, allProgresses } = getAllProgressesAndTotalPercentage(progresses, hyperstructureEntityId);
    return { percentage: toInteger(percentage * 100), progresses: allProgresses };
  };

  const getHyperstructureProgress = (hyperstructureEntityId: ID) => {
    let progressQueryResult = runQuery([
      Has(Progress),
      HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
    ]);
    let progresses = Array.from(progressQueryResult).map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    const { percentage, allProgresses } = getAllProgressesAndTotalPercentage(progresses, hyperstructureEntityId);
    return { percentage: toInteger(percentage * 100), progresses: allProgresses };
  };

  return { hyperstructures, useProgress, getHyperstructureProgress };
};

export const useUpdates = (hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { HyperstructureUpdate },
    },
  } = useDojo();

  const updates = useEntityQuery([
    Has(HyperstructureUpdate),
    HasValue(HyperstructureUpdate, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);

  return updates.map((updateEntityId) => getComponentValue(HyperstructureUpdate, updateEntityId));
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
  const allProgresses = HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map(({ resource, amount: resourceCost }) => {
    let foundProgress = progresses.find((progress) => progress!.resource_type === resource);
    let progress = {
      hyperstructure_entity_id: hyperstructureEntityId,
      resource_type: resource,
      amount: !foundProgress ? 0 : Number(foundProgress.amount) / EternumGlobalConfig.resources.resourcePrecision,
      percentage: !foundProgress
        ? 0
        : Math.floor(
            (Number(foundProgress.amount) / EternumGlobalConfig.resources.resourcePrecision / resourceCost!) * 100,
          ),
      costNeeded: resourceCost,
    };
    percentage +=
      (progress.amount *
        HyperstructureResourceMultipliers[progress.resource_type as keyof typeof HyperstructureResourceMultipliers]!) /
      TOTAL_CONTRIBUTABLE_AMOUNT;
    return progress;
  });
  return { allProgresses, percentage };
};
