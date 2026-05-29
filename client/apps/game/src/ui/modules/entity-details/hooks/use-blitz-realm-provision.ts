import { getStructuresDataFromTorii } from "@/dojo/queries";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { toast } from "sonner";
import { getContractByName } from "@dojoengine/core";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { CallData } from "starknet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";
import { dojoConfig } from "../../../../../dojo-config";

const REALM_PROVISION_SYNC_TIMEOUT_MS = 30_000;
const REALM_PROVISION_SYNC_POLL_INTERVAL_MS = 1_000;
const ETERNUM_NAMESPACE = "s1_eternum";

type LiveRealmInfo = NonNullable<ReturnType<typeof getRealmInfo>>;
type RealmProvisionSyncTarget = Parameters<typeof getStructuresDataFromTorii>[2][number];
type RealmProvisionToriiComponents = Parameters<typeof getStructuresDataFromTorii>[1];
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

const readLiveRealmInfo = (realmEntity: unknown, components: unknown): LiveRealmInfo | null => {
  if (!realmEntity) {
    return null;
  }

  return getRealmInfo(realmEntity as never, components as never) ?? null;
};

const buildRealmProvisionSyncTarget = (structureInfo: LiveRealmInfo): RealmProvisionSyncTarget => ({
  entityId: structureInfo.entityId,
  position: {
    col: structureInfo.position.x,
    row: structureInfo.position.y,
  },
});

const resolveRealmProvisionToriiComponents = (contractComponents: unknown): RealmProvisionToriiComponents | null => {
  if (!contractComponents) {
    return null;
  }

  return contractComponents as unknown as RealmProvisionToriiComponents;
};

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

const syncRealmStructureIfPossible = async ({
  toriiClient,
  contractComponents,
  syncTarget,
}: {
  toriiClient: Parameters<typeof getStructuresDataFromTorii>[0] | null | undefined;
  contractComponents: Parameters<typeof getStructuresDataFromTorii>[1] | null | undefined;
  syncTarget: RealmProvisionSyncTarget;
}) => {
  if (!toriiClient || !contractComponents) {
    return;
  }

  try {
    await getStructuresDataFromTorii(toriiClient, contractComponents, [syncTarget]);
  } catch (error) {
    console.error("[realm-provision] Failed to refresh realm data", error);
  }
};

const resolveBlitzRealmSystemsAddress = (): string => {
  const contract = getContractByName(dojoConfig.manifest, ETERNUM_NAMESPACE, "blitz_realm_systems");
  if (!contract?.address) {
    throw new Error("Blitz realm system address is missing from the active manifest.");
  }

  return contract.address;
};

const hasMainStarted = (currentBlockTimestamp: number, gameStartMainAt: number | null) =>
  typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt;

const hasSeasonEnded = (currentBlockTimestamp: number, gameEndAt: number | null) =>
  typeof gameEndAt === "number" && currentBlockTimestamp > gameEndAt;

const isProvisionLoadingState = (provisionActionState: RealmProvisionActionStatus) =>
  provisionActionState === "submitting" || provisionActionState === "syncing";

export const useBlitzRealmProvision = (structureEntityId: number | null): StructureProvisionResult | null => {
  const { setup, account, network } = useDojo();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const [provisionActionState, setProvisionActionState] = useState<RealmProvisionActionStatus>("idle");

  const realmEntity = useMemo(
    () => (structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : null),
    [structureEntityId],
  );

  const liveStructure = useComponentValue(setup.components.Structure, realmEntity as any);
  const liveStructureBuildings = useComponentValue(setup.components.StructureBuildings, realmEntity as any);
  const liveResources = useComponentValue(setup.components.Resource, realmEntity as any);

  const structureInfo = useMemo(() => {
    if (!structureEntityId || !realmEntity || !liveStructure) return null;

    return readLiveRealmInfo(realmEntity, setup.components);
  }, [liveResources, liveStructure, liveStructureBuildings, realmEntity, setup.components, structureEntityId]);

  const realmBuildings = useBuildings(Number(structureInfo?.position.x ?? 0), Number(structureInfo?.position.y ?? 0));
  const syncTarget = useMemo(
    () => (structureInfo ? buildRealmProvisionSyncTarget(structureInfo) : null),
    [structureInfo],
  );
  const toriiComponents = useMemo(
    () => resolveRealmProvisionToriiComponents(network.contractComponents),
    [network.contractComponents],
  );

  const isRealm = structureInfo?.category === StructureType.Realm;
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const ownerAddress = account.account?.address ? ContractAddress(account.account.address) : null;
  const isOwner = Boolean(structureInfo && ownerAddress && structureInfo.owner === ownerAddress);
  const isProvisioned = hasProvisionBuildingCount(liveStructureBuildings) || hasProvisionBuilding(realmBuildings);
  const isMainPhase = hasMainStarted(currentBlockTimestamp, gameStartMainAt);
  const isSeasonOver = hasSeasonEnded(currentBlockTimestamp, gameEndAt);
  const canProvision = Boolean(isBlitzWorld && isRealm && isOwner && isMainPhase && !isSeasonOver && !isProvisioned);
  const needsBootstrap = Boolean(isBlitzWorld && isRealm && isOwner && !isSeasonOver && !isProvisioned);
  const isProvisionLoading = isProvisionLoadingState(provisionActionState);
  const isProvisionLocked = provisionActionState !== "idle";

  useEffect(() => {
    if (isProvisioned && provisionActionState !== "idle") {
      setProvisionActionState("idle");
    }
  }, [isProvisioned, provisionActionState]);

  useEffect(() => {
    if (provisionActionState !== "syncing" || !syncTarget) {
      return;
    }

    if (isProvisioned) {
      setProvisionActionState("idle");
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = Math.ceil(REALM_PROVISION_SYNC_TIMEOUT_MS / REALM_PROVISION_SYNC_POLL_INTERVAL_MS);

    const pollForProvisioning = async () => {
      if (cancelled) {
        return;
      }

      if (attempts >= maxAttempts) {
        setProvisionActionState("syncTimeout");
        toast.error("Provision confirmed. Waiting for synced realm data before enabling the button again.");
        return;
      }

      attempts += 1;
      await syncRealmStructureIfPossible({
        toriiClient: network.toriiClient,
        contractComponents: toriiComponents,
        syncTarget,
      });

      if (cancelled) {
        return;
      }

      timeoutId = setTimeout(() => {
        void pollForProvisioning();
      }, REALM_PROVISION_SYNC_POLL_INTERVAL_MS);
    };

    void pollForProvisioning();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isProvisioned, network.toriiClient, provisionActionState, syncTarget, toriiComponents]);

  const handleProvision = useCallback(async () => {
    if (!structureInfo || !canProvision) {
      return;
    }

    setProvisionActionState("submitting");

    try {
      const blitzRealmSystemsAddress = resolveBlitzRealmSystemsAddress();
      await executeObservedClientTransaction({
        account: account.account,
        calls: {
          contractAddress: blitzRealmSystemsAddress,
          entrypoint: "provision_realm",
          calldata: CallData.compile([structureInfo.entityId]),
        },
        surface: "settlement",
        operation: "blitz_realm_systems.provision_realm",
      });

      setProvisionActionState("syncing");
    } catch (error) {
      if (isAlreadyProvisionedError(error) && syncTarget) {
        setProvisionActionState("syncing");
        await syncRealmStructureIfPossible({
          toriiClient: network.toriiClient,
          contractComponents: toriiComponents,
          syncTarget,
        });
        return;
      }

      setProvisionActionState("idle");
      throw error;
    }
  }, [account.account, canProvision, network.toriiClient, structureInfo, syncTarget, toriiComponents]);

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
