import { useCallback, useMemo, useState } from "react";
import { CallData, type Call } from "starknet";
import { toast } from "sonner";
import { getContractByName } from "@dojoengine/core";

import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { gameCallArgs, getGameNamespace } from "@/dojo/game-scope";
import { useDojo } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { withRealmActionSubmitTimeout } from "./realm-action-submit-timeout";

/**
 * Realm action firers that take `realmId` as an argument. Decouples the
 * upgrade / provision / multicall tx submission from per-realm state hooks
 * so the empire-wide Suggested Actions panel can fire any realm's action in
 * one click without instantiating N hooks.
 */
export const useRealmActions = () => {
  const { account } = useDojo();
  const [pendingRealmId, setPendingRealmId] = useState<ID | null>(null);

  const structureSystemsAddress = useMemo(() => {
    const contract = getContractByName(dojoConfig.manifest, getGameNamespace(), "structure_systems");
    return contract?.address ?? null;
  }, []);

  const blitzRealmSystemsAddress = useMemo(() => {
    const contract = getContractByName(dojoConfig.manifest, getGameNamespace(), "blitz_realm_systems");
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

  const buildProvisionCall = useCallback(
    (realmId: ID): Call | null => {
      if (!blitzRealmSystemsAddress) return null;
      return {
        contractAddress: blitzRealmSystemsAddress,
        entrypoint: "provision_realm",
        calldata: CallData.compile([...gameCallArgs(), realmId]),
      };
    },
    [blitzRealmSystemsAddress],
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

  const fireProvision = useCallback(
    async (realmId: ID) => {
      const call = buildProvisionCall(realmId);
      if (!call) {
        toast.error("Unable to resolve realm system contracts.");
        return;
      }
      await execute(realmId, [call], "realm_systems.provision");
    },
    [buildProvisionCall, execute],
  );

  const fireUpgradeAndProvision = useCallback(
    async (realmId: ID) => {
      const upgradeCall = buildUpgradeCall(realmId);
      const provisionCall = buildProvisionCall(realmId);
      if (!upgradeCall || !provisionCall) {
        toast.error("Unable to resolve realm system contracts.");
        return;
      }
      // Provision FIRST: provision_realm grants the realm's starting resources
      // (and turns on its economy). level_up then spends them in the same tx.
      // Running level_up first would revert — a freshly settled realm has no
      // resources until it is provisioned.
      await execute(realmId, [provisionCall, upgradeCall], "realm_systems.provision_and_upgrade");
    },
    [buildUpgradeCall, buildProvisionCall, execute],
  );

  return {
    pendingRealmId,
    fireUpgrade,
    fireProvision,
    fireUpgradeAndProvision,
  };
};
