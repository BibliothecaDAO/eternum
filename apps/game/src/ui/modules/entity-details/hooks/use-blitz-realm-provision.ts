import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { toast } from "@/ui/features/event-feed/notify";
import { useCallback, useMemo, useState } from "react";
import { configManager, getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings, useGame, useNativeRow, useNativeRevision } from "@bibliothecadao/react";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";
import { resolveRealmBootstrapErrorMessage } from "./realm-bootstrap-error";

type LiveRealmInfo = NonNullable<ReturnType<typeof getRealmInfo>>;
type RealmProvisionActionStatus = "idle" | "submitting";
type StructureBuildingsCounts = {
  packed_counts_1?: bigint | number | string;
  packed_counts_2?: bigint | number | string;
  packed_counts_3?: bigint | number | string;
};

interface StructureProvisionResult {
  canProvision: boolean;
  // Same intent as canProvision but without the isMainPhase gate. Drives
  // bootstrap-mode UI (icon + label) so we surface the Pickaxe/Bootstrap shape
  // even while the game hasn't started — the action stays disabled, but the
  // chrome doesn't fall back to the plain Level Up arrow.
  needsBootstrap: boolean;
  isOwner: boolean;
  isProvisioned: boolean;
  isProvisionLoading: boolean;
  isProvisionLocked: boolean;
  provisionActionState: RealmProvisionActionStatus;
  handleProvision: () => Promise<void>;
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

const isAlreadyProvisionedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("realm is already provisioned");
};

const hasMainStarted = (currentBlockTimestamp: number, gameStartMainAt: number | null) =>
  typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt;

export const useBlitzRealmProvision = (structureEntityId: number | null): StructureProvisionResult | null => {
  const { setup, account } = useGame();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const { gameStartMainAt, devModeOn } = useFactView(seasonClockView);
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const [provisionActionState, setProvisionActionState] = useState<RealmProvisionActionStatus>("idle");

  const keys =
    structureEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), entity_id: structureEntityId };
  const liveStructure = useNativeRow("Structure", keys);
  const liveStructureBuildings = useNativeRow("StructureBuildings", keys);
  const revision = useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  const structureInfo = useMemo(() => {
    if (structureEntityId === null || !liveStructure) return null;
    return getRealmInfo(structureEntityId, setup.store);
  }, [revision, liveStructure, liveStructureBuildings, setup.store, structureEntityId]);

  const realmBuildings = useBuildings(Number(structureInfo?.position.x ?? 0), Number(structureInfo?.position.y ?? 0));
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
  const isProvisionLoading = provisionActionState === "submitting";
  const isProvisionLocked = isProvisionLoading;

  const handleProvision = useCallback(async () => {
    if (!structureInfo || !canProvision) {
      return;
    }

    setProvisionActionState("submitting");

    // The provider resolves once Herald has applied the action, so the store already shows the provisioned realm.
    try {
      await setup.systemCalls.provision_realm({ signer: account.account, realm_entity_id: structureInfo.entityId });
    } catch (error) {
      if (isAlreadyProvisionedError(error)) return;
      toast.error(resolveRealmBootstrapErrorMessage(error));
      throw error;
    } finally {
      setProvisionActionState("idle");
    }
  }, [account.account, canProvision, structureInfo, setup.systemCalls]);

  if (!structureInfo) {
    return null;
  }

  return {
    canProvision,
    needsBootstrap,
    isOwner,
    isProvisioned,
    isProvisionLoading,
    isProvisionLocked,
    provisionActionState,
    handleProvision,
  };
};
