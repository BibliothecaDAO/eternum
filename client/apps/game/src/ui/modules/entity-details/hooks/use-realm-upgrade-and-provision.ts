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
 * Drives the "bootstrap" pickaxe. provision_realm is the floor — it grants the
 * realm's starting resources and turns on its economy — so a freshly settled
 * realm can always provision even when it cannot yet afford a level-up. When
 * the realm CAN already afford the upgrade, `structure_systems.level_up` is
 * bundled into the same `account.execute` multicall so it's one signature.
 *
 * Order matters: provision_realm runs FIRST, then level_up. level_up spends the
 * resources that provision_realm grants, so the reverse order would revert on a
 * fresh realm. When the realm can't be upgraded yet, this provisions alone and
 * the plain Level Up button takes over once provisioning seeds the economy.
 *
 * The hook composes the two existing per-action hooks so we keep their derived
 * gates (`canUpgrade`, `canProvision`) and reactive `useComponentValue`
 * subscriptions; the merged path fires the Calls in one shot and the chain
 * applies provision then upgrade atomically.
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
    // Provision is the floor; the level-up is opt-in (only when affordable).
    if (!structureEntityId || !canProvision) return;
    if (!blitzRealmSystemsAddress) {
      toast.error("Unable to resolve realm system contracts.");
      return;
    }

    // provision_realm FIRST — it grants the starting resources level_up spends.
    const calls: Call[] = [
      {
        contractAddress: blitzRealmSystemsAddress,
        entrypoint: "provision_realm",
        calldata: CallData.compile([structureEntityId]),
      },
    ];

    // Bundle the upgrade only when the realm can already afford it. A freshly
    // settled realm has no economy until provisioned, so it provisions alone
    // and the plain Level Up button takes over once resources land.
    if (canUpgrade) {
      if (!structureSystemsAddress) {
        toast.error("Unable to resolve realm system contracts.");
        return;
      }
      calls.push({
        contractAddress: structureSystemsAddress,
        entrypoint: "level_up",
        calldata: CallData.compile([structureEntityId]),
      });
    }

    setIsPending(true);
    try {
      await executeObservedClientTransaction({
        account: account.account,
        calls,
        surface: "settlement",
        operation: calls.length > 1 ? "realm_systems.provision_and_upgrade" : "blitz_realm_systems.provision_realm",
      });
    } catch (error) {
      console.error("[realm-upgrade-and-provision] Failed to submit provision multicall", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit the provision.");
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [
    account.account,
    blitzRealmSystemsAddress,
    canProvision,
    canUpgrade,
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
