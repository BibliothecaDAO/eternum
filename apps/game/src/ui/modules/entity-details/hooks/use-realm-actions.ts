import { useCallback, useMemo, useState } from "react";
import { CallData, type Call } from "starknet";
import { toast } from "@/ui/features/event-feed/notify";
import { getContractByName } from "@dojoengine/core";

import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { gameCallArgs, getGameNamespace } from "@bibliothecadao/eternum/game-client";
import { useDojo } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { withRealmActionSubmitTimeout } from "./realm-action-submit-timeout";

/**
 * Realm action firers that take `realmId` as an argument, so the empire-wide Suggested Actions panel can fire any
 * realm's upgrade in one click without instantiating N hooks. Provisioning is the provision runner's job.
 */
export const useRealmActions = () => {
  const { account } = useDojo();
  const [pendingRealmId, setPendingRealmId] = useState<ID | null>(null);

  const structureSystemsAddress = useMemo(() => {
    const contract = getContractByName(dojoConfig.manifest, getGameNamespace(), "structure_systems");
    return contract?.address ?? null;
  }, []);

  const buildUpgradeCall = useCallback(
    (realmId: ID): Call | null => {
      if (!structureSystemsAddress) return null;
      return {
        contractAddress: structureSystemsAddress,
        entrypoint: "level_up",
        calldata: CallData.compile([...gameCallArgs(), realmId]),
      };
    },
    [structureSystemsAddress],
  );

  const execute = useCallback(
    async (realmId: ID, calls: Call[], operation: string) => {
      if (calls.length === 0) {
        toast.error("Unable to resolve realm system contracts.");
        return;
      }

      setPendingRealmId(realmId);
      try {
        await withRealmActionSubmitTimeout(
          executeObservedClientTransaction({
            account: account.account,
            calls,
            surface: "settlement",
            operation,
            chain: env.VITE_PUBLIC_CHAIN,
            waitForConfirmation: false,
          }),
        );
      } catch (error) {
        console.error(`[realm-actions] ${operation} failed`, error);
        toast.error(extractReadableErrorMessage(error, "Failed to submit the transaction."));
        throw error;
      } finally {
        setPendingRealmId((current) => (current === realmId ? null : current));
      }
    },
    [account.account],
  );

  const fireUpgrade = useCallback(
    async (realmId: ID) => {
      const call = buildUpgradeCall(realmId);
      if (!call) {
        toast.error("Unable to resolve realm system contracts.");
        return;
      }
      await execute(realmId, [call], "realm_systems.upgrade");
    },
    [buildUpgradeCall, execute],
  );

  return {
    pendingRealmId,
    fireUpgrade,
  };
};
