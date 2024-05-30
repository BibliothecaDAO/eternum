import { useDojo } from "../context/DojoContext";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEntityQuery } from "@dojoengine/react";

export const useContributions = () => {
  const {
    setup: {
      components: { Contribution },
    },
  } = useDojo();

  const getContributions = (hyperstructureEntityId: bigint) => {
    const contributionsToHyperstructure = Array.from(
      runQuery([HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId })]),
    ).map((id) => getComponentValue(Contribution, id));

    return contributionsToHyperstructure;
  };

  const getContributionsByPlayerAddress = (playerAddress: bigint, hyperstructureEntityId: bigint) => {
    const contributionsToHyperstructure = useEntityQuery([
      HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId, player_address: playerAddress }),
    ])
      .map((id) => getComponentValue(Contribution, id))
      .filter((x) => x !== undefined);

    return contributionsToHyperstructure;
  };

  return {
    getContributions,
    getContributionsByPlayerAddress,
  };
};
