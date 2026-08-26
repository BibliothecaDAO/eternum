import {
  isPendingReservedHyperstructureCreation,
  subscribeBlitzHyperstructureCreationPending,
  submitActiveWorldBlitzHyperstructureCreation,
} from "@/services/blitz/blitz-hyperstructure-creation";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { HexPosition } from "@bibliothecadao/types";
import { useCallback, useState, useSyncExternalStore } from "react";

export const useBlitzHyperstructureCreation = ({
  hexCoords,
  enabled = true,
}: {
  hexCoords: HexPosition | null;
  enabled?: boolean;
}) => {
  const account = useAccountStore((state) => state.account);
  const [isCreating, setIsCreating] = useState(false);
  const isPending = useSyncExternalStore(
    subscribeBlitzHyperstructureCreationPending,
    () => (hexCoords ? isPendingReservedHyperstructureCreation(hexCoords) : false),
    () => false,
  );

  const canCreate = Boolean(enabled && account && hexCoords && !isPending && !isCreating);

  const createHyperstructure = useCallback(async () => {
    if (!enabled) {
      throw new Error("Hyperstructure creation is not available for this tile right now.");
    }
    if (!account) {
      throw new Error("Wait for your gameplay account before creating this hyperstructure.");
    }
    if (!hexCoords) {
      throw new Error("Select a reserved hyperstructure tile before creating it.");
    }
    if (isPendingReservedHyperstructureCreation(hexCoords)) {
      throw new Error("This hyperstructure is already being created.");
    }

    setIsCreating(true);

    try {
      await submitActiveWorldBlitzHyperstructureCreation({
        account,
        hexCoords,
      });
    } finally {
      setIsCreating(false);
    }
  }, [account, enabled, hexCoords]);

  return {
    canCreate,
    createHyperstructure,
    isCreating: isCreating || isPending,
  };
};
