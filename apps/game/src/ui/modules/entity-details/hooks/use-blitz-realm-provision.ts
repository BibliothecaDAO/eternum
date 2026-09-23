import { hasGameEnded } from "@bibliothecadao/eternum/game-sync";
import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { toast } from "@/ui/features/event-feed/notify";
import { useCallback, useEffect, useMemo, useState } from "react";
import { configManager, getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings, useGame, useNativeRow, useNativeRevision } from "@bibliothecadao/react";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";
import { withRealmActionSubmitTimeout } from "./realm-action-submit-timeout";
import { resolveRealmBootstrapErrorMessage } from "./realm-bootstrap-error";

const REALM_PROVISION_SYNC_TIMEOUT_MS = 30_000;

type LiveRealmInfo = NonNullable<ReturnType<typeof getRealmInfo>>;
type RealmProvisionActionStatus = "idle" | "submitting" | "syncing" | "syncTimeout";
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

const isProvisionLoadingState = (provisionActionState: RealmProvisionActionStatus) =>
  provisionActionState === "submitting" || provisionActionState === "syncing";

export const useBlitzRealmProvision = (structureEntityId: number | null): StructureProvisionResult | null => {
  const { setup, account } = useGame();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const { gameStartMainAt, gameEndAt, devModeOn } = useFactView(seasonClockView);
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
  const isSeasonOver = hasGameEnded("Live", gameEndAt ?? 0, currentBlockTimestamp);
  const canProvision = Boolean(isBlitzWorld && isRealm && isOwner && isMainPhase && !isSeasonOver && !isProvisioned);
  const needsBootstrap = Boolean(isBlitzWorld && isRealm && isOwner && !isSeasonOver && !isProvisioned);
  const isProvisionLoading = isProvisionLoadingState(provisionActionState);
  const isProvisionLocked = isProvisionLoading;

  useEffect(() => {
    if (!isProvisioned || provisionActionState === "idle") {
      return;
    }

    setProvisionActionState("idle");
  }, [isProvisioned, provisionActionState]);

  useEffect(() => {
    if (provisionActionState !== "syncing" || isProvisioned) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setProvisionActionState("syncTimeout");
      toast.error("Provision confirmed. Waiting for synced realm data before enabling the button again.");
    }, REALM_PROVISION_SYNC_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isProvisioned, provisionActionState]);

  const handleProvision = useCallback(async () => {
    if (!structureInfo || !canProvision) {
      return;
    }

    setProvisionActionState("submitting");

    try {
      await withRealmActionSubmitTimeout(
        setup.systemCalls.provision_realm({ signer: account.account, realm_entity_id: structureInfo.entityId }),
      );

      setProvisionActionState("syncing");
    } catch (error) {
      if (isAlreadyProvisionedError(error)) {
        setProvisionActionState("syncing");
        return;
      }

      setProvisionActionState("idle");
      toast.error(resolveRealmBootstrapErrorMessage(error));
      throw error;
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
