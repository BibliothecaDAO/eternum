import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import type { ArmyStaminaPresentation } from "@/lib/army-stamina/types";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { buildProjectedStaminaDisplayModel } from "@/ui/shared/lib/stamina-visuals";
import { getCharacterName } from "@/utils/agent";
import { getAddressName, getArmyRelicEffects, getGuildFromPlayerAddress, StaminaManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ArmyInfo, ContractAddress, HexPosition, ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

interface UseArmyEntityDetailOptions {
  armyEntityId: ID;
}

interface DerivedArmyData {
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
  staminaDisplay: ArmyStaminaPresentation | null;
  playerGuild?: { name: string } | undefined;
  addressName?: string;
  isMine: boolean;
  structureOwnerName?: string;
}

interface AlignmentBadge {
  label: string;
  className: string;
}

export const useArmyEntityDetail = ({ armyEntityId }: UseArmyEntityDetailOptions) => {
  const {
    network: { toriiClient },
    account: { account },
    setup: {
      components,
      systemCalls: { explorer_delete },
    },
  } = useDojo();
  const mode = useGameModeConfig();

  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const userAddress = ContractAddress(account.address);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const liveExplorerTroops = useComponentValue(
    components.ExplorerTroops,
    getEntityIdFromKeys([BigInt(armyEntityId)]),
  )?.troops;

  const {
    data: explorerData,
    isLoading: isLoadingExplorer,
    refetch: refetchExplorer,
  } = useQuery({
    queryKey: ["explorer", String(armyEntityId)],
    queryFn: async () => {
      if (!toriiClient || !armyEntityId) return undefined;
      return getExplorerFromToriiClient(toriiClient, armyEntityId);
    },
    staleTime: 5000,
  });

  const explorer = explorerData?.explorer;
  const explorerResources = explorerData?.resources;

  // Use live RECS troops as single source of truth, fall back to Torii query snapshot
  const troops: Troops | null = useMemo(() => {
    const candidate = liveExplorerTroops ?? explorer?.troops ?? null;
    if (!candidate) return null;
    // Validate — RECS can deliver objects with undefined interior fields for dead/zeroed armies
    if (typeof candidate.stamina?.amount !== "bigint" || typeof candidate.stamina?.updated_tick !== "bigint") {
      return null;
    }
    return candidate;
  }, [liveExplorerTroops, explorer?.troops]);

  const staminaSnapshot = useMemo(() => {
    if (!troops || !Number.isFinite(currentArmiesTick) || currentArmiesTick <= 0) return null;
    try {
      const stamina = StaminaManager.getStamina(troops, currentArmiesTick);
      return {
        current: Number(stamina.amount),
        max: StaminaManager.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier),
        stamina,
        troops,
      };
    } catch {
      return null;
    }
  }, [currentArmiesTick, troops]);

  const currentTroops = troops;
  const relicEffects = useMemo(
    () => (currentTroops ? getArmyRelicEffects(currentTroops, currentArmiesTick) : []),
    [currentArmiesTick, currentTroops],
  );

  const {
    data: structureData,
    isLoading: isLoadingStructure,
    refetch: refetchStructure,
  } = useQuery({
    queryKey: ["structure", String(explorer?.owner ?? "")],
    queryFn: async () => {
      if (!toriiClient || !explorer?.owner) return undefined;
      return getStructureFromToriiClient(toriiClient, explorer.owner);
    },
    enabled: !!explorer?.owner,
    staleTime: 5000,
  });

  const structure = structureData?.structure;
  const structureResources = structureData?.resources;

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefresh < 10000) {
      return;
    }

    setIsRefreshing(true);
    setLastRefresh(now);

    try {
      await Promise.all([refetchExplorer(), explorer?.owner ? refetchStructure() : Promise.resolve()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [lastRefresh, refetchExplorer, refetchStructure, explorer?.owner]);

  const derivedData: DerivedArmyData | undefined = useMemo(() => {
    if (!explorer) return undefined;

    const stamina = staminaSnapshot?.stamina ?? { amount: 0n, updated_tick: 0n };
    const maxStamina = staminaSnapshot?.max ?? 0;
    const staminaDisplay = staminaSnapshot
      ? buildProjectedStaminaDisplayModel({
          committedCurrent: Number(stamina.amount),
          committedMax: maxStamina,
          armiesTickTimeRemaining,
          currentArmiesTick,
          troops: staminaSnapshot.troops,
        })
      : null;

    const guild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
    const isMine = structure?.owner === userAddress;

    const addressName = structure?.owner
      ? getAddressName(structure?.owner, components)
      : getCharacterName(explorer.troops.tier as TroopTier, explorer.troops.category as TroopType, armyEntityId);

    const structureOwnerName = structure ? mode.structure.getName(structure).name : undefined;

    return {
      stamina,
      maxStamina,
      staminaDisplay,
      playerGuild: guild,
      addressName,
      isMine: Boolean(isMine),
      structureOwnerName,
    };
  }, [
    armiesTickTimeRemaining,
    armyEntityId,
    components,
    currentArmiesTick,
    explorer,
    mode,
    staminaSnapshot,
    structure,
    userAddress,
  ]);

  const alignmentBadge: AlignmentBadge | undefined = useMemo(() => {
    if (!derivedData) return undefined;

    if (derivedData.isMine) {
      return { label: "Your Army", className: "bg-gold/20 border border-gold/40 text-gold" };
    }

    if (derivedData.playerGuild) {
      return {
        label: `Guild · ${derivedData.playerGuild.name}`,
        className: "bg-order-protection/20 border border-order-protection/40 text-order-protection",
      };
    }

    if (derivedData.structureOwnerName) {
      return { label: "Visiting", className: "bg-blueish/20 border border-blueish/40 text-blueish" };
    }

    return undefined;
  }, [derivedData]);

  const handleDeleteExplorer = useCallback(async () => {
    setIsLoadingDelete(true);
    try {
      await explorer_delete({
        signer: account,
        explorer_id: armyEntityId,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDelete(false);
    }
  }, [account, armyEntityId, explorer_delete]);

  return {
    explorer,
    explorerResources,
    structure,
    structureResources,
    relicEffects,
    derivedData,
    alignmentBadge,
    isLoadingExplorer,
    isLoadingStructure,
    isRefreshing,
    handleRefresh,
    lastRefresh,
    handleDeleteExplorer,
    isLoadingDelete,
  };
};

const useBannerArmyInfo = (
  explorer: NonNullable<ReturnType<typeof useArmyEntityDetail>["explorer"]> | undefined,
  derivedData: DerivedArmyData | undefined,
  armyEntityId: ID,
  bannerPosition?: HexPosition,
) => {
  return useMemo<ArmyInfo | undefined>(() => {
    if (!explorer) return undefined;

    const baseName = derivedData?.addressName ?? `Army #${String(armyEntityId)}`;
    const fallbackX = bannerPosition?.col ?? Number((explorer as any).coord_x ?? (explorer as any).position?.x ?? 0);
    const fallbackY = bannerPosition?.row ?? Number((explorer as any).coord_y ?? (explorer as any).position?.y ?? 0);

    // TODO: fix this
    return {
      entityId: Number(armyEntityId),
      troops: explorer.troops,
      stamina: derivedData?.stamina?.amount ?? 0n,
      name: baseName,
      ownerName: derivedData?.addressName ?? "",
      isMine: derivedData?.isMine ?? false,
      isMercenary: false,
      isHome: false,
      position: {
        x: fallbackX,
        y: fallbackY,
        alt: false,
      },
      owner: BigInt(explorer.owner),
      entity_owner_id: explorer.owner,
      totalCapacity: 0,
      weight: 0,
      explorer: explorer,
      structure: undefined,
      hasAdjacentStructure: false,
      relicEffects: [],
    };
  }, [
    armyEntityId,
    bannerPosition?.col,
    bannerPosition?.row,
    derivedData?.addressName,
    derivedData?.isMine,
    derivedData?.stamina?.amount,
    explorer,
  ]);
};
