import { usePlayerNames } from "@/hooks/use-player-profile";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useMemo } from "react";
import { configManager, getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings } from "@/hooks/helpers/use-buildings";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";

type StructureBuildingsCounts = {
  packed_counts_1?: bigint | number | string;
  packed_counts_2?: bigint | number | string;
  packed_counts_3?: bigint | number | string;
};

interface StructureProvisionResult {
  /**
   * The realm still needs provisioning: a fresh Blitz realm of the viewer's. Its level-up step is Provision, sent once
   * play opens (the act-now gate, can-issue-orders).
   */
  needsBootstrap: boolean;
}

const hasProvisionBuilding = (buildings: Array<{ category: number }> | null | undefined) =>
  Boolean(buildings?.some((building) => building?.category === BuildingType.ResourceLabor));

const readPackedCount = (value: bigint | number | string | undefined): bigint => {
  if (value === undefined) {
    return 0n;
  }

  return BigInt(value);
};

const resolvePackedBuildingCounts = (structureBuildings: unknown): bigint[] | null => {
  if (!structureBuildings || typeof structureBuildings !== "object") {
    return null;
  }

  const counts = structureBuildings as StructureBuildingsCounts;
  return [
    readPackedCount(counts.packed_counts_1),
    readPackedCount(counts.packed_counts_2),
    readPackedCount(counts.packed_counts_3),
  ];
};

const hasProvisionBuildingCount = (structureBuildings: unknown): boolean => {
  const packedCounts = resolvePackedBuildingCounts(structureBuildings);
  if (!packedCounts) {
    return false;
  }

  return getBuildingCount(BuildingType.ResourceLabor, packedCounts) > 0;
};

export const useBlitzRealmProvision = (structureEntityId: number | null): StructureProvisionResult | null => {
  const { account } = useGame();
  const resolvedWorldGameMode = useResolvedWorldGameMode();

  const keys =
    structureEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), entity_id: structureEntityId };
  const liveStructure = useNativeRow("Structure", keys);
  const liveStructureBuildings = useNativeRow("StructureBuildings", keys);
  const facts = useNativeFacts(["ResourceBalance", "ResourceProduction", "ResourceWeight", "StructureBuildings"]);
  const names = usePlayerNames();
  const structureInfo = useMemo(() => {
    if (structureEntityId === null || !liveStructure) return null;
    return getRealmInfo(structureEntityId, facts.store, names.text);
  }, [facts, liveStructure, structureEntityId, names]);

  const realmBuildings = useBuildings(structureEntityId ?? undefined);
  const isRealm = structureInfo?.category === StructureType.Realm;
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const ownerAddress = account.account?.address ? ContractAddress(account.account.address) : null;
  const isOwner = Boolean(structureInfo && ownerAddress && structureInfo.owner === ownerAddress);
  const isProvisioned = hasProvisionBuildingCount(liveStructureBuildings) || hasProvisionBuilding(realmBuildings);
  const isSeasonOver = configManager.isGameOver();
  const needsBootstrap = Boolean(isBlitzWorld && isRealm && isOwner && !isSeasonOver && !isProvisioned);

  if (!structureInfo) {
    return null;
  }

  return { needsBootstrap };
};
