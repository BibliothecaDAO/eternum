import {
  ClientComponents,
  ContractAddress,
  ID,
  Resource,
  configManager,
  divideByPrecision,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useCallback } from "react";
import { useDojo } from "../";

export const useContributions = () => {
  const {
    setup: {
      components: { Contribution },
    },
  } = useDojo();

  const getContributions = (hyperstructureEntityId: ID) => {
    const contributionsToHyperstructure = Array.from(
      runQuery([HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId })]),
    ).map((id) => getComponentValue(Contribution, id));

    return contributionsToHyperstructure as ComponentValue<ClientComponents["Contribution"]["schema"]>[];
  };

  const useContributionsByPlayerAddress = (playerAddress: ContractAddress, hyperstructureEntityId: ID) => {
    const contributionsToHyperstructure = useEntityQuery([
      HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId, player_address: playerAddress }),
    ])
      .map((id) => getComponentValue(Contribution, id))
      .filter((x): x is ComponentValue<ClientComponents["Contribution"]["schema"]> => x !== undefined);

    return contributionsToHyperstructure;
  };

  const getContributionsTotalPercentage = (hyperstructureId: number, contributions: Resource[]) => {
    const totalPlayerContribution = divideByPrecision(
      contributions.reduce((acc, { amount, resourceId }) => {
        return acc + amount * configManager.getResourceRarity(resourceId);
      }, 0),
    );

    const totalHyperstructureContribution = configManager.getHyperstructureTotalContributableAmount(hyperstructureId);

    return totalPlayerContribution / totalHyperstructureContribution;
  };

  return {
    getContributions,
    useContributionsByPlayerAddress,
    getContributionsTotalPercentage,
  };
};

export const useGetHyperstructuresWithContributionsFromPlayer = () => {
  const {
    account: { account },
    setup: {
      components: { Contribution },
    },
  } = useDojo();

  const getContributions = useCallback(() => {
    const entityIds = runQuery([HasValue(Contribution, { player_address: ContractAddress(account.address) })]);
    const hyperstructureEntityIds = Array.from(entityIds).map(
      (entityId) => getComponentValue(Contribution, entityId)?.hyperstructure_entity_id ?? 0,
    );
    return new Set(hyperstructureEntityIds);
  }, [account.address]);

  return getContributions;
};

export const useGetUnregisteredContributions = () => {
  const {
    account: { account },
    setup: {
      components: { LeaderboardRegisterContribution },
    },
  } = useDojo();
  const getContributions = useGetHyperstructuresWithContributionsFromPlayer();

  const getUnregisteredContributions = useCallback(() => {
    const registeredContributionsEntities = runQuery([
      HasValue(LeaderboardRegisterContribution, { address: ContractAddress(account.address) }),
    ]);
    const registeredContributions = Array.from(registeredContributionsEntities)
      .map((entityId) => getComponentValue(LeaderboardRegisterContribution, entityId)?.hyperstructure_entity_id)
      .filter((x): x is number => x !== undefined);
    console.log("registeredContributions", registeredContributions);
    const hyperstructuresContributedTo = Array.from(getContributions());
    console.log("hyperstructuresContributedTo", hyperstructuresContributedTo);
    return hyperstructuresContributedTo.filter(
      (hyperstructureEntityId) =>
        !registeredContributions.some((contribution) => contribution === hyperstructureEntityId),
    );
  }, [getContributions]);

  return getUnregisteredContributions;
};
