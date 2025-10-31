import { getBlockTimestamp, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import {
  getAddressName,
  getArmyRelicEffects,
  getGuildFromPlayerAddress,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import {
  ArmyInfo,
  ContractAddress,
  HexPosition,
  ID,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { getCharacterName } from "@/utils/agent";

interface UseArmyEntityDetailOptions {
  armyEntityId: ID;
}

interface DerivedArmyData {
  stamina?: number;
  maxStamina?: number;
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

  const userAddress = ContractAddress(account.address);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: explorerData,
    isLoading: isLoadingExplorer,
    refetch: refetchExplorer,
  } = useQuery({
    queryKey: ["explorer", String(armyEntityId)],
    queryFn: async () => {
      if (!toriiClient || !armyEntityId) return undefined;
      const explorer = await getExplorerFromToriiClient(toriiClient, armyEntityId);
      const relicEffects = explorer.explorer
        ? getArmyRelicEffects(explorer.explorer.troops, getBlockTimestamp().currentArmiesTick)
        : [];
      return { ...explorer, relicEffects };
    },
    staleTime: 30000,
  });

  const explorer = explorerData?.explorer;
  const explorerResources = explorerData?.resources;
  const relicEffects = explorerData?.relicEffects ?? [];

  const {
    data: structureData,
    isLoading: isLoadingStructure,
    refetch: refetchStructure,
  } = useQuery({
    queryKey: ["structure", explorer?.owner ? String(explorer.owner) : undefined],
    queryFn: async () => {
      if (!toriiClient || !explorer?.owner) return undefined;
      return getStructureFromToriiClient(toriiClient, explorer.owner);
    },
    enabled: !!explorer?.owner,
    staleTime: 30000,
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

    const { currentArmiesTick } = getBlockTimestamp();

    const stamina = StaminaManager.getStamina(explorer.troops, currentArmiesTick);
    const maxStamina = StaminaManager.getMaxStamina(
      explorer.troops.category as TroopType,
      explorer.troops.tier as TroopTier,
    );

    const guild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
    const isMine = structure?.owner === userAddress;

    const addressName = structure?.owner
      ? getAddressName(structure?.owner, components)
      : getCharacterName(explorer.troops.tier as TroopTier, explorer.troops.category as TroopType, armyEntityId);

    const structureOwnerName = structure ? getStructureName(structure, getIsBlitz()).name : undefined;

    return {
      stamina,
      maxStamina,
      playerGuild: guild,
      addressName,
      isMine: Boolean(isMine),
      structureOwnerName,
    };
  }, [explorer, structure, components, userAddress, armyEntityId]);

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

export const useBannerArmyInfo = (
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

    return {
      ...explorer,
      entityId: Number((explorer as any).entityId ?? armyEntityId ?? explorer?.entity_id ?? 0),
      name: baseName,
      entity_owner_id: explorer.owner,
      isMine: derivedData?.isMine ?? false,
      isHome: (explorer as any).is_home ?? false,
      hasAdjacentStructure: (explorer as any).has_adjacent_structure ?? false,
      position: {
        x: fallbackX,
        y: fallbackY,
      },
    } as ArmyInfo;
  }, [armyEntityId, bannerPosition?.col, bannerPosition?.row, derivedData?.addressName, derivedData?.isMine, explorer]);
};
