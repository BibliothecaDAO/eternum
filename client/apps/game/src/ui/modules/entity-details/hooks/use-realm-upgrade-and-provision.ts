import { useCallback, useMemo, useState } from "react";
import { CallData, type Call } from "starknet";
import { toast } from "sonner";
import { getContractByName } from "@dojoengine/core";

import { dojoConfig } from "../../../../../dojo-config";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { useDojo } from "@bibliothecadao/react";

import { useStructureUpgrade } from "./use-structure-upgrade";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";

const ETERNUM_NAMESPACE = "s1_eternum";

interface RealmUpgradeAndProvisionResult {
  canUpgrade: boolean;
  canProvision: boolean;
  canUpgradeAndProvision: boolean;
  isPending: boolean;
  handleUpgradeAndProvision: () => Promise<void>;
}

/**
 * Bundles `structure_systems.level_up` + `blitz_realm_systems.provision_realm`
 * into a single account.execute multicall. Without this, players who can do
 * both have to click + sign twice. With it: one chip, one signature, one tx.
 *
 * The hook composes the two existing per-action hooks so we keep their state
 * machines (loading, sync polling, optimistic resource overrides) intact for
 * the standalone buttons. The merged path bypasses the underlying queue and
 * fires both Calls in one shot — the chain still applies upgrade then
 * provision atomically, and both hooks' reactive `useComponentValue`
 * subscriptions pick up the result.
 */
export const useRealmUpgradeAndProvision = (
  structureEntityId: number | null,
): RealmUpgradeAndProvisionResult => {
  const { account } = useDojo();
  const upgrade = useStructureUpgrade(structureEntityId);
  const provision = useBlitzRealmProvision(structureEntityId);
  const [isPending, setIsPending] = useState(false);

  const canUpgrade = Boolean(upgrade?.canUpgrade && !upgrade.isUpgradeLocked);
  const canProvision = Boolean(provision?.canProvision && !provision.isProvisionLocked);
  const canUpgradeAndProvision = canUpgrade && canProvision;

  const structureSystemsAddress = useMemo(() => {
    const contract = getContractByName(dojoConfig.manifest, ETERNUM_NAMESPACE, "structure_systems");
    return contract?.address ?? null;
  }, []);

  const blitzRealmSystemsAddress = useMemo(() => {
    const contract = getContractByName(dojoConfig.manifest, ETERNUM_NAMESPACE, "blitz_realm_systems");
    return contract?.address ?? null;
  }, []);

  const handleUpgradeAndProvision = useCallback(async () => {
    if (!structureEntityId || !canUpgradeAndProvision) return;
    if (!structureSystemsAddress || !blitzRealmSystemsAddress) {
      toast.error("Unable to resolve realm system contracts.");
      return;
    }

    const calls: Call[] = [
      {
        contractAddress: structureSystemsAddress,
        entrypoint: "level_up",
        calldata: CallData.compile([structureEntityId]),
      },
      {
        contractAddress: blitzRealmSystemsAddress,
        entrypoint: "provision_realm",
        calldata: CallData.compile([structureEntityId]),
      },
    ];

    setIsPending(true);
    try {
      await executeObservedClientTransaction({
        account: account.account,
        calls,
        surface: "settlement",
        operation: "realm_systems.upgrade_and_provision",
      });
    } catch (error) {
      console.error("[realm-upgrade-and-provision] Failed to submit multicall", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit the combined upgrade.");
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [
    account.account,
    blitzRealmSystemsAddress,
    canUpgradeAndProvision,
    structureEntityId,
    structureSystemsAddress,
  ]);

  return {
    canUpgrade,
    canProvision,
    canUpgradeAndProvision,
    isPending,
    handleUpgradeAndProvision,
  };
};
