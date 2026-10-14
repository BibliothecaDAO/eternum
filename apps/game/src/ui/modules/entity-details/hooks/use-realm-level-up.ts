import { configManager } from "@bibliothecadao/eternum";
import { type ID, StructureType } from "@bibliothecadao/types";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { useCallback } from "react";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";
import { useRealmUpgradeAndProvision } from "./use-realm-upgrade-and-provision";
import { useStructureUpgrade } from "./use-structure-upgrade";

export type RealmLevelUp = {
  /** Provision first (a fresh Blitz realm, in one transaction with the first level when affordable), then level up. */
  mode: "provision" | "level-up" | "max";
  /** The verb a button shows: "Provision", "Level up to City", "Fully upgraded". */
  word: string;
  /** It can be taken now. */
  ready: boolean;
  loading: boolean;
  nextLevel: number;
  nextLevelName: string | null;
  requirements: NonNullable<ReturnType<typeof useStructureUpgrade>>["requirements"];
  run: () => void;
};

/**
 * The realm's one level-up step and whether it can be taken: provision while a Blitz realm still needs it, then the
 * plain level-up, until the last level. Every surface that offers the step reads it here.
 */
export const useRealmLevelUp = (structureEntityId: ID | null): RealmLevelUp | null => {
  const entityId = typeof structureEntityId === "number" ? structureEntityId : null;
  const upgrade = useStructureUpgrade(entityId);
  const provision = useBlitzRealmProvision(entityId);
  const bootstrap = useRealmUpgradeAndProvision(entityId);

  const runUpgrade = useCallback(() => {
    if (!upgrade) return;
    void upgrade.handleUpgrade().catch((error) => toast.error(extractReadableErrorMessage(error, "Level up failed.")));
  }, [upgrade]);
  // The provision flow words its own failure.
  const runProvision = useCallback(
    () => void bootstrap.handleUpgradeAndProvision().catch(() => undefined),
    [bootstrap],
  );

  if (!upgrade) return null;

  const currentLevel = upgrade.currentLevel ?? 0;
  const isMax = upgrade.isMaxLevel || currentLevel >= configManager.getMaxLevel(StructureType.Realm);
  const common = {
    nextLevel: upgrade.nextLevel ?? 0,
    nextLevelName: upgrade.nextLevelName,
    requirements: upgrade.requirements,
  };

  if (isMax) return { ...common, mode: "max", word: "Fully upgraded", ready: false, loading: false, run: () => {} };

  if (provision?.needsBootstrap) {
    const loading = bootstrap.isPending || upgrade.isUpgradeLoading || Boolean(provision.isProvisionLoading);
    const ready = bootstrap.canProvision && !loading;
    return { ...common, mode: "provision", word: "Provision", ready, loading, run: ready ? runProvision : () => {} };
  }

  const meetsRequirements = (upgrade.missingRequirements?.length ?? 0) === 0;
  const ready = upgrade.isOwner && meetsRequirements && !upgrade.isUpgradeLocked;
  return {
    ...common,
    mode: "level-up",
    word: upgrade.nextLevelName ? `Level up to ${upgrade.nextLevelName}` : "Level up",
    ready,
    loading: upgrade.isUpgradeLoading,
    run: ready ? runUpgrade : () => {},
  };
};
