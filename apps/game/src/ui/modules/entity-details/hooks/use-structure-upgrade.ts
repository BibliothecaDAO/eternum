import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { configManager, divideByPrecision, getBalance, getRealmInfo } from "@bibliothecadao/eternum";
import { useArrivalsByStructure } from "@/hooks/helpers/use-resource-arrivals";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, getLevelName } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";

interface RawUpgradeCost {
  resource: number;
  amount: number;
}

interface IncomingRequirementDelivery {
  amount: number;
  etaSeconds: number;
}

interface UpgradeRequirement {
  resource: number;
  amount: number;
  current: number;
  progress: number;
  /** Resources already sent to this structure but still riding the delivery tick. */
  incoming: IncomingRequirementDelivery | null;
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
  upgradeActionState: "idle" | "syncing";
  isUpgradeLoading: boolean;
  isUpgradeLocked: boolean;
  handleUpgrade: () => Promise<void>;
}

export const formatIncomingEta = (etaSeconds: number): string => {
  if (etaSeconds <= 0) return "landing";
  if (etaSeconds < 90) return `in ${Math.ceil(etaSeconds)}s`;
  return `in ${Math.ceil(etaSeconds / 60)}m`;
};

export const useStructureUpgrade = (structureEntityId: number | null): StructureUpgradeResult | null => {
  const { setup, account } = useGame();
  const currentDefaultTick = useCurrentDefaultTick();
  const [isUpgradeLocked, setUpgradeLocked] = useState(false);
  const revision = useNativeRevision([
    "StructureBuildings",
    "ResourceWeight",
    "ResourceBalance",
    "ResourceProduction",
    "ProductionBonus",
  ]);
  const liveStructure = useNativeRow(
    "Structure",
    structureEntityId
      ? {
          game_id: configManager.getActiveGameId(),
          entity_id: structureEntityId,
        }
      : undefined,
  );
  const structureInfo = useMemo(
    () => (liveStructure && structureEntityId ? (getRealmInfo(structureEntityId, setup.store) ?? null) : null),
    [liveStructure, setup.store, structureEntityId, revision],
  );

  const nextLevel = useMemo(() => {
    if (!structureInfo) return null;
    const candidate = structureInfo.level + 1;
    return candidate <= configManager.getMaxLevel(structureInfo.category) ? candidate : null;
  }, [structureInfo]);

  const rawCosts = useMemo<RawUpgradeCost[]>(() => {
    if (!nextLevel) return [];
    return (configManager.realmUpgradeCosts[nextLevel] as RawUpgradeCost[]) || [];
  }, [nextLevel]);

  // Sent resources ride the delivery tick and belong to no balance while in
  // transit; surfacing them here is what tells the player their transfer is
  // coming instead of the requirement row silently staying red.
  const pendingArrivals = useArrivalsByStructure(structureEntityId ?? 0);
  const incomingByResource = useMemo(() => {
    const incoming = new Map<number, IncomingRequirementDelivery>();
    for (const arrival of pendingArrivals) {
      const etaSeconds = Math.max(0, Number(arrival.arrivesAt) - currentDefaultTick);
      for (const { resourceId, amount } of arrival.resources) {
        const entry = incoming.get(resourceId) ?? { amount: 0, etaSeconds };
        entry.amount += divideByPrecision(amount);
        entry.etaSeconds = Math.min(entry.etaSeconds, etaSeconds);
        incoming.set(resourceId, entry);
      }
    }
    return incoming;
  }, [currentDefaultTick, pendingArrivals]);

  const requirements = useMemo<UpgradeRequirement[]>(() => {
    if (!structureInfo || !nextLevel || !structureEntityId) return [];
    return rawCosts.map((cost) => {
      const rawBalance = getBalance(structureEntityId, cost.resource, currentDefaultTick, setup.store).balance;
      const current = divideByPrecision(rawBalance);
      const incoming = incomingByResource.get(cost.resource) ?? null;
      return {
        resource: cost.resource,
        amount: cost.amount,
        current,
        progress: cost.amount > 0 ? Math.min(100, (current * 100) / cost.amount) : 100,
        incoming: incoming && incoming.amount > 0 ? incoming : null,
      };
    });
  }, [
    revision,
    currentDefaultTick,
    incomingByResource,
    nextLevel,
    rawCosts,
    setup.store,
    structureEntityId,
    structureInfo,
  ]);

  const upgradeReadiness = useMemo(() => {
    if (!structureInfo || !nextLevel) {
      return { canUpgrade: false, upgradeProgress: 0, missingRequirements: [] as UpgradeRequirement[] };
    }
    if (requirements.length === 0) {
      return { canUpgrade: true, upgradeProgress: 100, missingRequirements: [] as UpgradeRequirement[] };
    }
    const missingRequirements = requirements.filter(({ current, amount }) => current < amount);
    return {
      canUpgrade: missingRequirements.length === 0,
      upgradeProgress: Math.floor(
        requirements.reduce((sum, requirement) => sum + requirement.progress, 0) / requirements.length,
      ),
      missingRequirements,
    };
  }, [nextLevel, requirements, structureInfo]);

  const handleUpgrade = useCallback(async () => {
    if (!structureInfo || !nextLevel || !structureEntityId) return;
    if (isUpgradeLocked) return;

    setUpgradeLocked(true);
    try {
      await setup.systemCalls.upgrade_realm({
        signer: account.account,
        realm_entity_id: structureInfo.entityId,
      });
    } finally {
      setUpgradeLocked(false);
    }
  }, [account.account, isUpgradeLocked, nextLevel, structureEntityId, setup.systemCalls, structureInfo]);

  if (!structureInfo) return null;

  return {
    currentLevel: structureInfo.level,
    currentLevelName: getLevelName(structureInfo.level),
    nextLevel,
    nextLevelName: nextLevel ? getLevelName(nextLevel) : null,
    canUpgrade: upgradeReadiness.canUpgrade,
    upgradeProgress: upgradeReadiness.upgradeProgress,
    requirements,
    missingRequirements: upgradeReadiness.missingRequirements,
    isOwner: structureInfo.owner === ContractAddress(account.account.address),
    isMaxLevel: nextLevel === null,
    upgradeActionState: isUpgradeLocked ? "syncing" : "idle",
    isUpgradeLoading: isUpgradeLocked,
    isUpgradeLocked,
    handleUpgrade,
  };
};
