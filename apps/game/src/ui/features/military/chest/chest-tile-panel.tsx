import { useCallback, type ReactNode } from "react";
import type { HexPosition, ID } from "@bibliothecadao/types";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { ChestOpening } from "@/hooks/store/use-chest-opening-store";
import { requestChestOpening } from "@/three/scenes/worldmap-chest-open-request";
import { useAdjacentOwnExplorer } from "./use-adjacent-own-explorer";
import { CRATE_NEEDS_AN_ARMY } from "@/ui/design-system/kit/words";
import { ChestTileDetails } from "@/ui/features/world/components/actions/chest-tile-details";

// The crate panel opens with the player's adjacent explorer; the contract accepts no other opener.
export const ChestTilePanel = ({
  rewardChestId,
  opening,
  selectedHex,
  coordsLabel,
  headerAction,
}: {
  rewardChestId?: ID;
  opening: ChestOpening | null;
  selectedHex: HexPosition;
  coordsLabel?: string;
  headerAction?: ReactNode;
}) => {
  const account = useAccountStore((state) => state.account);
  const explorerId = useAdjacentOwnExplorer(selectedHex);
  const canOpen = Boolean(account) && explorerId !== null;
  // The world map is the one opener: it plays a chest's moment where the game has one.
  const handleOpen = useCallback(() => {
    if (explorerId !== null) requestChestOpening({ explorerId, hex: selectedHex });
  }, [explorerId, selectedHex]);
  return (
    <ChestTileDetails
      rewardChestId={rewardChestId}
      coordsLabel={coordsLabel}
      headerAction={headerAction}
      opening={opening}
      open={canOpen ? { onOpen: handleOpen } : { blocked: CRATE_NEEDS_AN_ARMY }}
    />
  );
};
