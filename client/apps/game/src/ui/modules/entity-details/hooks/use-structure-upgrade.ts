import { useCallback, useMemo } from "react";

import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getRealmInfo,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, getLevelName } from "@bibliothecadao/types";

interface RawUpgradeCost {
  resource: number;
  amount: number;
}

export interface UpgradeRequirement {
  resource: number;
  amount: number;
  current: number;
  progress: number;
}

export interface StructureUpgradeResult {
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
  handleUpgrade: () => Promise<void>;
}

export const useStructureUpgrade = (structureEntityId: number | null): StructureUpgradeResult | null => {
  const dojo = useDojo();
  const { currentDefaultTick } = useBlockTimestamp();

  const structureInfo = useMemo(() => {
    if (!structureEntityId) return null;

    return getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), dojo.setup.components);
  }, [structureEntityId, dojo.setup.components]);

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
      const balance = getBalance(structureEntityId, cost.resource, currentDefaultTick, dojo.setup.components);
      const currentAmount = divideByPrecision(balance.balance);
      const progress = cost.amount > 0 ? Math.min(100, (currentAmount * 100) / cost.amount) : 100;

      return {
        resource: cost.resource,
        amount: cost.amount,
        current: currentAmount,
        progress,
      };
    });
  }, [structureInfo, nextLevel, rawCosts, structureEntityId, currentDefaultTick, dojo.setup.components]);

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

  const handleUpgrade = useCallback(async () => {
    if (!structureInfo) return;

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: structureInfo.entityId,
    });
  }, [dojo.account.account, dojo.setup.systemCalls, structureInfo]);

  if (!structureInfo) return null;

  const isOwner = structureInfo.owner === ContractAddress(dojo.account.account.address);

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
    handleUpgrade,
  };
};
