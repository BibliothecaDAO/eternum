import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useMemo } from "react";
import { configManager, getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings } from "@/hooks/helpers/use-buildings";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";
import { getPlayerName } from "@/services/identity/player-profiles";

type StructureBuildingsCounts = {
  packed_counts_1?: bigint | number | string;
  packed_counts_2?: bigint | number | string;
  packed_counts_3?: bigint | number | string;
};

interface StructureProvisionResult {
  /** The realm can be provisioned now: a fresh Blitz realm of the viewer's, in the main phase. */
  canProvision: boolean;
  /**
   * The realm still needs provisioning, main phase or not: its level-up step is Provision even before the game starts,
   * when the action stays disabled.
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

const hasMainStarted = (currentBlockTimestamp: number, gameStartMainAt: number | null) =>
  typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt;

export const useBlitzRealmProvision = (structureEntityId: number | null): StructureProvisionResult | null => {
  const { setup, account } = useGame();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const { gameStartMainAt, devModeOn } = useFactView(seasonClockView);
  const resolvedWorldGameMode = useResolvedWorldGameMode();

  const keys =
    structureEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), entity_id: structureEntityId };
  const liveStructure = useNativeRow("Structure", keys);
  const liveStructureBuildings = useNativeRow("StructureBuildings", keys);
  const revision = useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  const structureInfo = useMemo(() => {
    if (structureEntityId === null || !liveStructure) return null;
    return getRealmInfo(structureEntityId, setup.store, getPlayerName);
  }, [revision, liveStructure, liveStructureBuildings, setup.store, structureEntityId]);

  const realmBuildings = useBuildings(structureEntityId ?? undefined);
  const isRealm = structureInfo?.category === StructureType.Realm;
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const ownerAddress = account.account?.address ? ContractAddress(account.account.address) : null;
  const isOwner = Boolean(structureInfo && ownerAddress && structureInfo.owner === ownerAddress);
  const isProvisioned = hasProvisionBuildingCount(liveStructureBuildings) || hasProvisionBuilding(realmBuildings);
  // dev_mode worlds (sandbox) bypass the chain's main-phase + season-end gates,
  // so a freshly settled realm can provision/upgrade immediately. Mirror that.
  const isMainPhase = devModeOn || hasMainStarted(currentBlockTimestamp, gameStartMainAt);
  const isSeasonOver = configManager.isGameOver();
  const canProvision = Boolean(isBlitzWorld && isRealm && isOwner && isMainPhase && !isSeasonOver && !isProvisioned);
  const needsBootstrap = Boolean(isBlitzWorld && isRealm && isOwner && !isSeasonOver && !isProvisioned);

  if (!structureInfo) {
    return null;
  }

  return { canProvision, needsBootstrap };
};
