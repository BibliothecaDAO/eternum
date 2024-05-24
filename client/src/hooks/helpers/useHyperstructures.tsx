import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { isInteger } from "lodash";

export type Hyperstructure = ClientComponents["Structure"]["schema"] &
  ClientComponents["Progress"]["schema"][] &
  ClientComponents["Contribution"]["schema"][] &
  ClientComponents["Position"]["schema"] & {
    entityIdPoseidon: Entity;
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
      const contributions = Object.values(
        runQuery([Has(Contribution), HasValue(Contribution, { hyperstructure_entity_id: hyperstructure!.entity_id })]),
      ).map((contributionEntityId) => getComponentValue(Contribution, contributionEntityId));
      const progress = getProgress(hyperstructure!.entity_id, Progress);
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
        progress,
        owner,
        entityIdPoseidon: hyperstructureEntityId,
      };
    },
  );
  return hyperstructures;
};

const getProgress = (hyperstructureEntityId: bigint, Progress: Component) => {
  let progressQueryResult = Array.from(
    runQuery([Has(Progress), HasValue(Progress, { hyperstructure_entity_id: hyperstructureEntityId })]),
  );
  let progresses = progressQueryResult.map((progressEntityId) => {
    return getComponentValue(Progress, progressEntityId);
  });
  let allProgresses = Object.keys(ResourcesIds)
    .filter((key) => isInteger(Number(key)))
    .map((resourceId) => {
      let id = Number(resourceId);
      const foundProgress = progresses.find((progress) => progress!.resource_type === id);
      if (!foundProgress) {
        return { hyperstructure_entity_id: hyperstructureEntityId, resource_type: id, amount: 0 };
      }
      return foundProgress;
    });
  return allProgresses;
};
