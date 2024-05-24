import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { HYPERSTRUCTURE_TOTAL_COSTS_SCALED, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { isInteger } from "lodash";

export type Hyperstructure = ClientComponents["Structure"]["schema"] &
  ClientComponents["Progress"]["schema"][] &
  ClientComponents["Contribution"]["schema"][] &
  ClientComponents["Position"]["schema"] & {
    entityIdPoseidon: Entity;
  };
export type ProgressWithPourcentage = {
  pourcentage: number;
  costNeeded: number;
  hyperstructure_entity_id: bigint;
  resource_type: number;
  amount: number;
};

export const useHyperstructures = () => {
  const {
    setup: {
      components: { Structure, Contribution, Progress, Position, Owner },
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
      return {
        ...hyperstructure,
        ...position,
        ...contributions,
        owner,
        entityIdPoseidon: hyperstructureEntityId,
      };
    },
  );

  const useProgress = (hyperstructureEntityId: bigint): ProgressWithPourcentage[] => {
    let progressQueryResult = useEntityQuery([
      Has(Progress),
      HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId }),
    ]);
    let progresses = progressQueryResult.map((progressEntityId) => {
      return getComponentValue(Progress, progressEntityId);
    });
    let allProgresses = Object.keys(ResourcesIds)
      .filter((key) => isInteger(Number(key)))
      .map((resourceId) => {
        let id = Number(resourceId);
        const foundProgress = progresses.find((progress) => progress!.resource_type === id);
        if (!foundProgress) {
          return {
            hyperstructure_entity_id: hyperstructureEntityId,
            resource_type: id,
            amount: 0,
            pourcentage: 0,
            costNeeded: 0,
          };
        }
        const resourceCost = Object.values(HYPERSTRUCTURE_TOTAL_COSTS_SCALED).find(
          ({ resource }) => resource === id,
        )!.amount;
        return {
          pourcentage: Math.floor((foundProgress.amount / resourceCost!) * 100),
          costNeeded: resourceCost,
          ...foundProgress,
        };
      });
    return allProgresses;
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
