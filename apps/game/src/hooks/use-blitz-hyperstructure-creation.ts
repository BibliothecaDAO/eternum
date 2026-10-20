import {
  isPendingReservedHyperstructureCreation,
  subscribeBlitzHyperstructureCreationPending,
  submitActiveWorldBlitzHyperstructureCreation,
} from "@/services/blitz/blitz-hyperstructure-creation";
import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import type { HexPosition } from "@bibliothecadao/types";
import { useCallback, useState, useSyncExternalStore } from "react";

export const useBlitzHyperstructureCreation = ({
  contractHex,
  enabled = true,
}: {
  contractHex: HexPosition | null;
  enabled?: boolean;
}) => {
  const {
    account: { account },
    setup: { systemCalls },
  } = useGame();
  useCurrentBlockTimestamp();
  const ordersAllowed = useUIStore(canIssueOrders);
  // Why the game takes no action yet ("Starts in 2m 33s"): the control says so before the click, and stays shut.
  const refusal = useActNowRefusal();
  const [isCreating, setIsCreating] = useState(false);
  const isPending = useSyncExternalStore(
    subscribeBlitzHyperstructureCreationPending,
    () => (contractHex ? isPendingReservedHyperstructureCreation(contractHex) : false),
    () => false,
  );

  const canCreate = Boolean(
    ordersAllowed && refusal === null && enabled && account && contractHex && !isPending && !isCreating,
  );

  const createHyperstructure = useCallback(async () => {
    if (!enabled) {
      throw new Error("Hyperstructure creation is not available for this tile right now.");
    }
    if (!account) {
      throw new Error("Wait for your gameplay account before creating this hyperstructure.");
    }
    if (!contractHex) {
      throw new Error("Select a reserved hyperstructure tile before creating it.");
    }
    if (isPendingReservedHyperstructureCreation(contractHex)) {
      throw new Error("This hyperstructure is already being created.");
    }

    setIsCreating(true);

    try {
      await submitActiveWorldBlitzHyperstructureCreation({ account, contractHex, systemCalls });
    } finally {
      setIsCreating(false);
    }
  }, [account, enabled, contractHex, systemCalls]);

  return {
    canCreate,
    refusal,
    createHyperstructure,
    isCreating: isCreating || isPending,
  };
};
