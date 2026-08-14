import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  type RealmUpgradeAction,
  type RealmUpgradeActionStatus,
  useRealmUpgradeStore,
} from "@/hooks/store/use-realm-upgrade-store";
import { extractTransactionHash, waitForTransactionConfirmation } from "@/ui/utils/transactions";
import { configManager, divideByPrecision, getBalance, getRealmInfo, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, getLevelName, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { gameEntityKey } from "@/dojo/game-scope";

const REALM_UPGRADE_SYNC_TIMEOUT_MS = 30_000;
const REALM_UPGRADE_SYNC_POLL_INTERVAL_MS = 1_000;

type LiveRealmInfo = NonNullable<ReturnType<typeof getRealmInfo>>;
type RealmUpgradeWaitProvider = { waitForTransactionWithCheck?: (txHash: string) => Promise<unknown> };
type RealmUpgradeWaitAccount = { waitForTransaction?: (txHash: string) => Promise<unknown> };

interface RawUpgradeCost {
  resource: number;
  amount: number;
}

interface UpgradeRequirement {
  resource: number;
  amount: number;
  current: number;
  progress: number;
}

interface StructureUpgradeResult {
  currentLevel: number;
  currentLevelName: string;
  nextLevel: number | null;
  nextLevelName: string | null;
  canUpgrade: boolean;
  upgradeProgress: number;
  requirements: UpgradeRequirement[];
  missingRequirements: UpgradeRequirement[];
  isOwner: boolean;
  isMaxLevel: boolean;
  upgradeActionState: RealmUpgradeActionStatus;
  isUpgradeLoading: boolean;
  isUpgradeLocked: boolean;
  handleUpgrade: () => Promise<void>;
}

const readLiveRealmInfo = (realmEntity: unknown, components: unknown): LiveRealmInfo | null => {
  if (!realmEntity) {
    return null;
  }

  return getRealmInfo(realmEntity as never, components as never) ?? null;
};

const hasRealmReachedExpectedLevel = ({
  realmEntity,
  components,
  expectedLevel,
}: {
  realmEntity: unknown;
  components: unknown;
  expectedLevel: number;
}) => {
  const liveRealmInfo = readLiveRealmInfo(realmEntity, components);
  return (liveRealmInfo?.level ?? 0) >= expectedLevel;
};

const waitForRealmUpgradePollInterval = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, REALM_UPGRADE_SYNC_POLL_INTERVAL_MS);
  });
};

const waitForRealmUpgradeSync = async ({
  realmEntity,
  components,
  expectedLevel,
}: {
  realmEntity: unknown;
  components: unknown;
  expectedLevel: number;
}) => {
  const maxAttempts = Math.ceil(REALM_UPGRADE_SYNC_TIMEOUT_MS / REALM_UPGRADE_SYNC_POLL_INTERVAL_MS);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (hasRealmReachedExpectedLevel({ realmEntity, components, expectedLevel })) {
      return true;
    }

    if (attempt < maxAttempts - 1) {
      await waitForRealmUpgradePollInterval();
    }
  }

  return hasRealmReachedExpectedLevel({ realmEntity, components, expectedLevel });
};

const resolveUpgradeActionState = (pendingUpgrade: RealmUpgradeAction | null) => {
  return pendingUpgrade?.status ?? "idle";
};

const isRealmUpgradeLoadingState = (upgradeActionState: RealmUpgradeActionStatus) => {
  return upgradeActionState === "submitting" || upgradeActionState === "confirming" || upgradeActionState === "syncing";
};

export const useStructureUpgrade = (structureEntityId: number | null): StructureUpgradeResult | null => {
  const { setup, account, network } = useDojo();
  const currentDefaultTick = useCurrentDefaultTick();
  const pendingUpgrade = useRealmUpgradeStore((state) =>
    structureEntityId ? (state.upgradesByRealm[structureEntityId] ?? null) : null,
  );
  const startUpgrade = useRealmUpgradeStore((state) => state.startUpgrade);
  const setUpgradeStatus = useRealmUpgradeStore((state) => state.setUpgradeStatus);
  const clearUpgrade = useRealmUpgradeStore((state) => state.clearUpgrade);

  const realmEntity = useMemo(
    () => (structureEntityId ? gameEntityKey([BigInt(structureEntityId)]) : null),
    [structureEntityId],
  );

  const liveStructure = useComponentValue(setup.components.Structure, realmEntity as any);
  const liveStructureBuildings = useComponentValue(setup.components.StructureBuildings, realmEntity as any);
  const liveResources = useComponentValue(setup.components.Resource, realmEntity as any);

  const structureInfo = useMemo(() => {
    if (!structureEntityId || !realmEntity || !liveStructure) return null;

    return readLiveRealmInfo(realmEntity, setup.components);
  }, [structureEntityId, realmEntity, liveStructure, liveStructureBuildings, liveResources, setup.components]);

  const nextLevel = useMemo(() => {
    if (!structureInfo) return null;
    const candidate = structureInfo.level + 1;
    return candidate <= configManager.getMaxLevel(structureInfo.category) ? candidate : null;
  }, [structureInfo]);

  const rawCosts = useMemo<RawUpgradeCost[]>(() => {
    if (!nextLevel) return [];

    return (configManager.realmUpgradeCosts[nextLevel] as RawUpgradeCost[]) || [];
  }, [nextLevel]);

  const requirements = useMemo<UpgradeRequirement[]>(() => {
    if (!structureInfo || !nextLevel || !structureEntityId) return [];

    return rawCosts.map((cost) => {
      try {
        const balance = getBalance(structureEntityId, cost.resource, currentDefaultTick, setup.components);
        // Guard against Infinity or NaN values that can cause BigInt conversion errors
        const rawBalance = balance.balance;
        const safeBalance = Number.isFinite(rawBalance) ? rawBalance : 0;
        const currentAmount = divideByPrecision(safeBalance);
        const progress = cost.amount > 0 ? Math.min(100, (currentAmount * 100) / cost.amount) : 100;

        return {
          resource: cost.resource,
          amount: cost.amount,
          current: currentAmount,
          progress,
        };
      } catch {
        // If balance calculation fails, return zero progress
        return {
          resource: cost.resource,
          amount: cost.amount,
          current: 0,
          progress: 0,
        };
      }
    });
  }, [currentDefaultTick, liveResources, nextLevel, rawCosts, setup.components, structureEntityId, structureInfo]);

  const { canUpgrade, upgradeProgress, missingRequirements } = useMemo(() => {
    if (!structureInfo || !nextLevel) {
      return {
        canUpgrade: false,
        upgradeProgress: 0,
        missingRequirements: [] as UpgradeRequirement[],
      };
    }

    if (requirements.length === 0) {
      return {
        canUpgrade: true,
        upgradeProgress: 100,
        missingRequirements: [] as UpgradeRequirement[],
      };
    }

    const missing = requirements.filter((requirement) => requirement.current < requirement.amount);
    const totalProgress = requirements.reduce((sum, requirement) => sum + requirement.progress, 0);
    const averageProgress = Math.floor(totalProgress / requirements.length);

    return {
      canUpgrade: missing.length === 0,
      upgradeProgress: averageProgress,
      missingRequirements: missing,
    };
  }, [requirements, structureInfo, nextLevel]);

  const upgradeActionState = resolveUpgradeActionState(pendingUpgrade);
  const isUpgradeLoading = isRealmUpgradeLoadingState(upgradeActionState);
  const isUpgradeLocked = upgradeActionState !== "idle";

  useEffect(() => {
    if (!structureInfo || !pendingUpgrade) {
      return;
    }

    if (structureInfo.level >= pendingUpgrade.expectedLevel) {
      clearUpgrade(structureInfo.entityId);
    }
  }, [clearUpgrade, pendingUpgrade, structureInfo]);

  const handleUpgrade = useCallback(async () => {
    if (!structureInfo || !nextLevel) {
      return;
    }

    const existingUpgrade = useRealmUpgradeStore.getState().getUpgrade(structureInfo.entityId);
    if (existingUpgrade) {
      return;
    }

    startUpgrade(structureInfo.entityId, nextLevel);
    const removeResourceOverrides = new ResourceManager(
      setup.components,
      structureInfo.entityId,
    ).optimisticResourceUpdates(
      rawCosts.map((cost) => ({
        resourceId: cost.resource as ResourcesIds,
        amount: -cost.amount,
      })),
    );

    try {
      const upgradeResult = await setup.systemCalls.upgrade_realm({
        signer: account.account,
        realm_entity_id: structureInfo.entityId,
      });

      const txHash = extractTransactionHash(upgradeResult);
      if (!txHash) {
        throw new Error("Realm upgrade transaction did not return a transaction hash.");
      }

      setUpgradeStatus(structureInfo.entityId, "confirming");

      await waitForTransactionConfirmation({
        txHash,
        provider: network.provider as RealmUpgradeWaitProvider,
        account: account.account as RealmUpgradeWaitAccount,
        label: "realm upgrade",
      });

      setUpgradeStatus(structureInfo.entityId, "syncing");

      const synced = await waitForRealmUpgradeSync({
        realmEntity,
        components: setup.components,
        expectedLevel: nextLevel,
      });

      if (synced) {
        clearUpgrade(structureInfo.entityId);
        return;
      }

      setUpgradeStatus(structureInfo.entityId, "syncTimeout");
      toast.error("Realm upgrade confirmed. Waiting for synced realm data before enabling the next upgrade.");
    } catch (error) {
      clearUpgrade(structureInfo.entityId);
      throw error;
    } finally {
      removeResourceOverrides();
    }
  }, [
    account.account,
    clearUpgrade,
    network.provider,
    nextLevel,
    realmEntity,
    rawCosts,
    setUpgradeStatus,
    setup.components,
    setup.systemCalls,
    startUpgrade,
    structureInfo,
  ]);

  if (!structureInfo) return null;

  const isOwner = structureInfo.owner === ContractAddress(account.account.address);

  return {
    currentLevel: structureInfo.level,
    currentLevelName: getLevelName(structureInfo.level),
    nextLevel,
    nextLevelName: nextLevel ? getLevelName(nextLevel) : null,
    canUpgrade,
    upgradeProgress,
    requirements,
    missingRequirements,
    isOwner,
    isMaxLevel: nextLevel === null,
    upgradeActionState,
    isUpgradeLoading,
    isUpgradeLocked,
    handleUpgrade,
  };
};
