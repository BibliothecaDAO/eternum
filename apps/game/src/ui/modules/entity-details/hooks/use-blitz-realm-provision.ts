import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { toast } from "sonner";
import { getContractByName } from "@dojoengine/core";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { CallData } from "starknet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBuildingCount, getRealmInfo } from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { BuildingType, ContractAddress, StructureType } from "@bibliothecadao/types";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";
import { withRealmActionSubmitTimeout } from "./realm-action-submit-timeout";
import { gameCallArgs, gameEntityKey, getGameNamespace } from "@/dojo/game-scope";
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

const readLiveRealmInfo = (realmEntity: unknown, components: unknown): LiveRealmInfo | null => {
  if (!realmEntity) {
    return null;
  }

  return getRealmInfo(realmEntity as never, components as never) ?? null;
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

const resolveBlitzRealmSystemsAddress = (): string => {
  const contract = getContractByName(dojoConfig.manifest, getGameNamespace(), "blitz_realm_systems");
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
  const { setup, account } = useDojo();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const devModeOn = useUIStore((state) => state.devModeOn);
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const [provisionActionState, setProvisionActionState] = useState<RealmProvisionActionStatus>("idle");

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
  }, [liveResources, liveStructure, liveStructureBuildings, realmEntity, setup.components, structureEntityId]);

  const realmBuildings = useBuildings(Number(structureInfo?.position.x ?? 0), Number(structureInfo?.position.y ?? 0));
  const isRealm = structureInfo?.category === StructureType.Realm;
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const ownerAddress = account.account?.address ? ContractAddress(account.account.address) : null;
  const isOwner = Boolean(structureInfo && ownerAddress && structureInfo.owner === ownerAddress);
  const isProvisioned = hasProvisionBuildingCount(liveStructureBuildings) || hasProvisionBuilding(realmBuildings);
  // dev_mode worlds (sandbox) bypass the chain's main-phase + season-end gates,
  // so a freshly settled realm can provision/upgrade immediately. Mirror that.
  const isMainPhase = devModeOn || hasMainStarted(currentBlockTimestamp, gameStartMainAt);
  const isSeasonOver = !devModeOn && hasSeasonEnded(currentBlockTimestamp, gameEndAt);
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
      const blitzRealmSystemsAddress = resolveBlitzRealmSystemsAddress();
      await withRealmActionSubmitTimeout(
        executeObservedClientTransaction({
          account: account.account,
          calls: {
            contractAddress: blitzRealmSystemsAddress,
            entrypoint: "provision_realm",
            calldata: CallData.compile([...gameCallArgs(), structureInfo.entityId]),
          },
          surface: "settlement",
          operation: "blitz_realm_systems.provision_realm",
          chain: env.VITE_PUBLIC_CHAIN,
          waitForConfirmation: false,
        }),
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
  }, [account.account, canProvision, structureInfo]);

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
