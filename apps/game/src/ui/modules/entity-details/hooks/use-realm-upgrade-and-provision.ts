import { useCallback, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";

import { useGame } from "@/hooks/context/game-context";

import { useStructureUpgrade } from "./use-structure-upgrade";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";
import { resolveRealmBootstrapErrorMessage } from "./realm-bootstrap-error";

interface RealmUpgradeAndProvisionResult {
  canUpgrade: boolean;
  canProvision: boolean;
  canUpgradeAndProvision: boolean;
  isPending: boolean;
  handleUpgradeAndProvision: () => Promise<void>;
}

/** Provisioning and an affordable upgrade share one recorded command and roll back together. */
export const useRealmUpgradeAndProvision = (structureEntityId: number | null): RealmUpgradeAndProvisionResult => {
  const {
    account,
    setup: { systemCalls },
  } = useGame();
  const upgrade = useStructureUpgrade(structureEntityId);
  const provision = useBlitzRealmProvision(structureEntityId);
  const [isPending, setIsPending] = useState(false);

  const canUpgrade = Boolean(upgrade?.canUpgrade && !upgrade.isUpgradeLocked);
  const canProvision = Boolean(provision?.canProvision && !provision.isProvisionLocked);
  const canUpgradeAndProvision = canUpgrade && canProvision;

  const handleUpgradeAndProvision = useCallback(async () => {
    // Provision is the floor; the level-up is opt-in (only when affordable).
    if (!structureEntityId || !canProvision || !provision) return;

    // Provision-only (the common fresh-realm case): delegate to the standalone
    // provision flow. It keeps the button locked through authoritative sync and absorbs
    // the "already provisioned" race, so a second click in the post-confirm /
    // pre-sync window can't fire a duplicate provision_realm that reverts.
    if (!canUpgrade) {
      await provision.handleProvision();
      return;
    }

    setIsPending(true);
    try {
      await systemCalls.provision_realm({ signer: account.account, realm_entity_id: structureEntityId, upgrade: true });
    } catch (error) {
      console.warn("realm_bootstrap_failed", { message: resolveRealmBootstrapErrorMessage(error) });
      toast.error(resolveRealmBootstrapErrorMessage(error));
      throw error;
    } finally {
      setIsPending(false);
    }
  }, [account.account, canProvision, canUpgrade, provision, structureEntityId, systemCalls]);

  // Surface both paths' loading: the compound command (local isPending) and
  // the delegated provision-only flow (provision.isProvisionLoading).
  const isBusy = isPending || Boolean(provision?.isProvisionLoading);

  return {
    canUpgrade,
    canProvision,
    canUpgradeAndProvision,
    isPending: isBusy,
    handleUpgradeAndProvision,
  };
};
