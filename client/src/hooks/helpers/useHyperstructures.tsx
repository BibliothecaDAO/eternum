import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { HYPERSTRUCTURE_TOTAL_COSTS_SCALED, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { toInteger } from "lodash";
import { ResourceMultipliers, TOTAL_CONTRIBUTABLE_AMOUNT } from "../store/useLeaderBoardStore";
import { shortString } from "starknet";

export type Hyperstructure = ClientComponents["Structure"]["schema"] &
  ClientComponents["Progress"]["schema"][] &
  ClientComponents["Contribution"]["schema"][] &
  ClientComponents["Position"]["schema"] & {
    entityIdPoseidon: Entity;
  } & { name: string };

export type ProgressWithPercentage = {
  percentage: number;
  costNeeded: number;
  hyperstructure_entity_id: bigint;
  resource_type: number;
  amount: number;
};

export type Progress = {
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
      const owner = `0x${getComponentValue(
        Owner,
        runQuery([Has(Owner), HasValue(Owner, { entity_id: hyperstructure!.entity_id })])
          .values()
          .next().value,
      )?.address.toString(16)}`;
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

  const useProgress = (hyperstructureEntityId: bigint): Progress => {
    let percentage = 0;
    let progressQueryResult = useEntityQuery([
      Has(Progress),
      HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
    ]);
    let progresses = progressQueryResult.map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    let allProgresses = HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map(({ resource }) => {
      let foundProgress = progresses.find((progress) => progress!.resource_type === resource);
      const resourceCost = Object.values(HYPERSTRUCTURE_TOTAL_COSTS_SCALED).find(
        ({ resource }) => resource === resource,
      )!.amount;
      let progress = {
        hyperstructure_entity_id: hyperstructureEntityId,
        resource_type: resource,
        amount: !foundProgress ? 0 : foundProgress.amount,
        percentage: !foundProgress ? 0 : Math.floor((foundProgress.amount / resourceCost!) * 100),
        costNeeded: resourceCost,
      };
      percentage +=
        (progress.amount * ResourceMultipliers[progress.resource_type as keyof typeof ResourceMultipliers]!) /
        TOTAL_CONTRIBUTABLE_AMOUNT;
      return progress;
    });
    return { percentage: toInteger(percentage * 100), progresses: allProgresses };
  };

  return { hyperstructures, useProgress };
};

const getContributions = (hyperstructureEntityId: bigint, Contribution: Component) => {
  const contributions = runQuery([
    Has(Contribution),
    HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);
  return Array.from(contributions).map((contributionEntityId) => getComponentValue(Contribution, contributionEntityId));
};
