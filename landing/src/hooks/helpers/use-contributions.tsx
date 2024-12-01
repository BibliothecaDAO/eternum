import { ClientComponents } from "@/dojo/createClientComponents";
import { getTotalPointsPercentage } from "@/dojo/modelManager/leaderboard/LeaderboardUtils";
import { ContractAddress, ID, Resource } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

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

  const getContributionsTotalPercentage = (contributions: Resource[]) => {
    return contributions.reduce((acc, { resourceId, amount }) => {
      return acc + getTotalPointsPercentage(resourceId, BigInt(amount));
    }, 0);
  };

  return {
    getContributions,
    useContributionsByPlayerAddress,
    getContributionsTotalPercentage,
  };
};
