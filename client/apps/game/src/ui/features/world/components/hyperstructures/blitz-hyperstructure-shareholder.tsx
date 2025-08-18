import { getIsBlitz } from "@bibliothecadao/eternum";

import { getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, useOwnedHyperstructuresEntityIds } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import React, { useEffect } from "react";

export const BlitzSetHyperstructureShareholdersTo100 = React.memo(() => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { allocate_shares },
    },
  } = useDojo();

  // listen to all the hyperstructures where you are owner with useEntityQuery
  const ownedHyperstructures = useOwnedHyperstructuresEntityIds();

  useEffect(() => {
    const isBlitz = getIsBlitz();
    if (!isBlitz) return;

    const allocateShares = async () => {
      // Skip if no hyperstructures or effect was cancelled
      if (ownedHyperstructures.length === 0) return;

      const leaderboardManager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());

      for (const hyperstructure of ownedHyperstructures) {
        // Skip if this hyperstructure was already processed or effect was cancelled

        const currentCoOwners = leaderboardManager.getCurrentCoOwners(hyperstructure);

        if (
          currentCoOwners?.coOwners[0]?.percentage !== 10000 &&
          currentCoOwners?.coOwners[0]?.address !== ContractAddress(account.address)
        ) {
          try {
            await allocate_shares({
              signer: account,
              hyperstructure_entity_id: hyperstructure,
              co_owners: [[ContractAddress(account.address), 10000]],
            });
          } catch (error) {
            console.error("Failed to allocate shares for hyperstructure", hyperstructure, error);
          }
        }
      }
    };

    allocateShares();
  }, [ownedHyperstructures, account.address]);

  return null;
});
