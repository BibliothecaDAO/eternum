import { usePlayerNames } from "@/hooks/use-player-profile";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getArmy } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { ContractAddress, getNeighborHexes, type ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useSpatialProjection } from "@/hooks/use-spatial-projection";

const ARMY_LAYER = ["armies"] as const;

/** The player's explorer standing next to a hex, if any: the contract lets only an adjacent explorer open a crate. */
export const useAdjacentOwnExplorer = (hex: { col: number; row: number }): ID | null => {
  const {
    setup: { store },
  } = useGame();
  const address = useAccountStore((state) => state.account?.address ?? null);
  // Re-scans whenever an army moves.
  const spatial = useSpatialProjection(ARMY_LAYER);
  const mapLayer = useUIStore((state) => state.mapLayer);

  const names = usePlayerNames();
  return useMemo(() => {
    if (!spatial.projection || !address) return null;
    const playerAddress = ContractAddress(address);
    for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
      for (const army of spatial.projection.getArmiesAtHex({ ...neighbor, alt: mapLayer })) {
        if (getArmy(army.entityId, playerAddress, store, names.text)?.isMine) return army.entityId;
      }
    }
    return null;
  }, [address, store, hex.col, hex.row, spatial, mapLayer, names]);
};
