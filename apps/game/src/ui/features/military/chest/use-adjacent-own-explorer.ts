import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getArmy } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, getNeighborHexes, type ID } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

/** The player's explorer standing next to a hex, if any: the contract lets only an adjacent explorer open a crate. */
export const useAdjacentOwnExplorer = (hex: { col: number; row: number }): ID | null => {
  const {
    setup: { components },
  } = useDojo();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
  const mapLayer = useUIStore((state) => state.mapLayer);
  const [revision, setRevision] = useState(0);

  useEffect(() => projection?.subscribeArmies(() => setRevision((current) => current + 1)), [projection]);

  return useMemo(() => {
    if (!projection || !address) return null;
    const playerAddress = ContractAddress(address);
    for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
      for (const army of projection.getArmiesAtHex({ ...neighbor, alt: mapLayer })) {
        if (getArmy(army.entityId, playerAddress, components)?.isMine) return army.entityId;
      }
    }
    return null;
    // revision re-runs the scan whenever an army moves.
  }, [address, components, hex.col, hex.row, projection, revision, mapLayer]);
};
