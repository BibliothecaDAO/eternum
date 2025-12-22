import { useCallback } from "react";

import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { toast } from "sonner";

import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { sqlApi } from "@/services/api";

/**
 * Hook that provides navigation to a player's main realm on the world map.
 * Used when clicking a player in the prediction market odds or positions.
 */
export const useMarketPlayerNavigation = () => {
  const { setup } = useDojo();
  const goToStructure = useGoToStructure(setup);

  const navigateToPlayer = useCallback(
    async (playerAddress: string) => {
      if (!playerAddress) {
        toast.error("Invalid player address");
        return;
      }

      try {
        // Fetch player's structures
        const structures = await sqlApi.fetchStructuresByOwner(playerAddress);

        if (!structures || structures.length === 0) {
          toast.error("Player has no structures on the map");
          return;
        }

        // Navigate to the player's first (main) structure
        const mainStructure = structures[0];
        await goToStructure(
          mainStructure.entity_id,
          new Position({ x: mainStructure.coord_x, y: mainStructure.coord_y }),
          true, // use map view
        );
      } catch (error) {
        console.error("[useMarketPlayerNavigation] Failed to navigate to player", error);
        toast.error("Could not find player's location on the map");
      }
    },
    [goToStructure],
  );

  return { navigateToPlayer };
};
