import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getRealmInfo,
} from "@bibliothecadao/eternum";
import { getLevelName } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { useMemo } from "react";

export interface UpgradeCost {
  resource: number;
  amount: number;
}

export interface StructureUpgradeInfo {
  currentLevel: number;
  nextLevel: number | null;
  canUpgrade: boolean;
  upgradeProgress: number;
  upgradeCosts: UpgradeCost[];
  currentLevelName: string;
  nextLevelName: string | null;
  handleUpgrade: () => Promise<void>;
}

export const useStructureUpgrade = (structureEntityId: number): StructureUpgradeInfo => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const structureInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), dojo.setup.components),
    [structureEntityId, dojo.setup.components],
  );

  const nextLevel = useMemo(() => {
    if (!structureInfo) return null;
    const nextLevel = structureInfo.level + 1;
    return nextLevel <= configManager.getMaxLevel(structureInfo.category) ? nextLevel : null;
  }, [structureInfo]);

  const upgradeCosts = useMemo(() => {
    if (!nextLevel) return [];
    return configManager.realmUpgradeCosts[nextLevel] || [];
  }, [nextLevel]);

  const { canUpgrade, upgradeProgress } = useMemo(() => {
    if (!structureInfo || !nextLevel) return { canUpgrade: false, upgradeProgress: 0 };

    let totalProgress = 0;

    const hasRequirements = upgradeCosts.every((cost) => {
      const balance = getBalance(structureEntityId, cost.resource, currentDefaultTick, dojo.setup.components);
      const currentAmount = divideByPrecision(balance.balance);
      const progress = Math.min(100, (currentAmount * 100) / cost.amount);
      totalProgress += progress;
      return currentAmount >= cost.amount;
    });

    const averageProgress = upgradeCosts.length > 0 ? Math.floor(totalProgress / upgradeCosts.length) : 0;

    return {
      canUpgrade: hasRequirements,
      upgradeProgress: averageProgress,
    };
  }, [structureInfo, nextLevel, structureEntityId, currentDefaultTick, dojo.setup.components, upgradeCosts]);

  const handleUpgrade = async () => {
    if (!structureInfo) return;

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: structureInfo.entityId,
    });
  };

  if (!structureInfo) {
    return {
      currentLevel: 0,
      nextLevel: null,
      canUpgrade: false,
      upgradeProgress: 0,
      upgradeCosts: [],
      currentLevelName: "",
      nextLevelName: null,
      handleUpgrade,
    };
  }

  return {
    currentLevel: structureInfo.level,
    nextLevel,
    canUpgrade,
    upgradeProgress,
    upgradeCosts,
    currentLevelName: getLevelName(structureInfo.level),
    nextLevelName: nextLevel ? getLevelName(nextLevel) : null,
    handleUpgrade,
  };
};
