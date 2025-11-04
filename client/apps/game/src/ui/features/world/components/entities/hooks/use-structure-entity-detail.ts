import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { sqlApi } from "@/services/api";
import { displayAddress } from "@/ui/utils/utils";
import {
  MAP_DATA_REFRESH_INTERVAL,
  MapDataStore,
  Position,
  getAddressName,
  getBlockTimestamp,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getIsBlitz,
  getStructureArmyRelicEffects,
  getStructureName,
  getStructureRelicEffects,
  getStructureTypeName,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ContractAddress, ID, MERCENARIES, RelicEffectWithEndTick, StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

interface UseStructureEntityDetailOptions {
  structureEntityId: ID;
}

interface AlignmentBadge {
  label: string;
  className: string;
}

export const useStructureEntityDetail = ({ structureEntityId }: UseStructureEntityDetailOptions) => {
  const {
    setup,
    network: { toriiClient },
    account,
    setup: { components },
  } = useDojo();

  const goToStructure = useGoToStructure(setup);

  const userAddress = ContractAddress(account.account.address);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const structureEntityIdNumber = Number(structureEntityId ?? 0);
  const isBlitz = getIsBlitz();

  const {
    data: structureDetails,
    isLoading: isLoadingStructure,
    refetch: refetchStructure,
  } = useQuery({
    queryKey: ["structureDetails", String(structureEntityId), String(userAddress)],
    queryFn: async () => {
      if (!toriiClient || !structureEntityId || !components || !userAddress) return null;

      const { structure, resources, productionBoostBonus } = await getStructureFromToriiClient(
        toriiClient,
        structureEntityId,
      );
      const relicEffects: RelicEffectWithEndTick[] = [];
      const { currentArmiesTick } = getBlockTimestamp();
      if (structure) {
        relicEffects.push(...getStructureArmyRelicEffects(structure, currentArmiesTick));
      }
      if (productionBoostBonus) {
        relicEffects.push(...getStructureRelicEffects(productionBoostBonus, currentArmiesTick));
      }
      if (!structure)
        return {
          structure: null,
          resources: null,
          playerGuild: undefined,
          guards: [],
          isAlly: false,
          addressName: MERCENARIES,
          isMine: false,
          hyperstructureRealmCount: undefined,
          relicEffects,
        };

      const isMine = structure.owner === userAddress;
      const guild = getGuildFromPlayerAddress(ContractAddress(structure.owner), components);
      const guards = getGuardsByStructure(structure);
      const userGuild = getGuildFromPlayerAddress(userAddress, components);
      const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;
      const addressName = structure.owner ? getAddressName(structure.owner, components) : MERCENARIES;

      const hyperstructureRealmCount =
        structure.base.category === StructureType.Hyperstructure
          ? MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi).getHyperstructureRealmCount(structure.entity_id)
          : undefined;

      return {
        structure,
        resources,
        playerGuild: guild,
        guards,
        isAlly,
        addressName,
        isMine,
        relicEffects,
        hyperstructureRealmCount,
      };
    },
    staleTime: 30000,
  });

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefresh < 10000) {
      return;
    }

    setIsRefreshing(true);
    setLastRefresh(now);

    try {
      await refetchStructure();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [lastRefresh, refetchStructure]);

  const structure = structureDetails?.structure;
  const resources = structureDetails?.resources;
  const playerGuild = structureDetails?.playerGuild;
  const guards = structureDetails?.guards || [];
  const addressName = structureDetails?.addressName;
  const isMine = structureDetails?.isMine || false;
  const isAlly = structureDetails?.isAlly || false;
  const hyperstructureRealmCount = structureDetails?.hyperstructureRealmCount;
  const relicEffects = structureDetails?.relicEffects ?? [];

  const ownerHex = structure?.owner ? `0x${structure.owner.toString(16)}` : undefined;
  const ownerDisplayName = addressName || displayAddress(ownerHex ?? "0x0");

  const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return getStructureTypeName(structure.base.category as StructureType, isBlitz);
  }, [structure?.base?.category, isBlitz]);

  const backgroundImage = useMemo(() => {
    if (!structure?.base?.category) return undefined;

    switch (structure.base.category as StructureType) {
      case StructureType.Realm: {
        const level = Number(structure.base.level ?? 0);
        if (level >= 3) {
          return "/images/buildings/construction/castleThree.png";
        }
        if (level >= 2) {
          return "/images/buildings/construction/castleTwo.png";
        }
        if (level >= 1) {
          return "/images/buildings/construction/castleOne.png";
        }
        return "/images/buildings/construction/castleZero.png";
      }
      case StructureType.Hyperstructure:
        return "/images/buildings/construction/hyperstructure.png";
      case StructureType.FragmentMine:
        return "/images/buildings/construction/essence-rift.png";
      case StructureType.Village:
        return "/images/buildings/construction/camp.png";
      case StructureType.Bank:
        return "/images/buildings/construction/bank.png";
      default:
        return undefined;
    }
  }, [structure?.base?.category, structure?.base?.level]);

  const guardSlotsUsed =
    structure?.base.troop_guard_count !== undefined ? Number(structure.base.troop_guard_count) : undefined;
  const guardSlotsMax =
    structure?.base.troop_max_guard_count !== undefined ? Number(structure?.base?.troop_max_guard_count) : undefined;

  const alignmentBadge: AlignmentBadge | undefined = useMemo(() => {
    if (!structure) return undefined;

    const ownerValue = structure.owner;
    const isUnclaimed = ownerValue === undefined || ownerValue === null || ownerValue === 0n;

    if (isMine) {
      return {
        label: "Your Structure",
        className: "bg-gold/20 border border-gold/40 text-gold",
      };
    }

    if (isAlly && !isUnclaimed) {
      return {
        label: "Ally Controlled",
        className: "bg-order-protection/20 border border-order-protection/40 text-order-protection",
      };
    }

    if (isUnclaimed) {
      return {
        label: "Unclaimed",
        className: "bg-blueish/20 border border-blueish/40 text-blueish",
      };
    }

    return {
      label: "Enemy Controlled",
      className: "bg-danger/20 border border-danger/40 text-danger",
    };
  }, [structure, isMine, isAlly]);

  const progress = useMemo(() => {
    return isHyperstructure ? getHyperstructureProgress(structure?.entity_id, components) : undefined;
  }, [isHyperstructure, structure?.entity_id, components]);

  const structureName = useMemo(() => {
    return structure ? getStructureName(structure, isBlitz).name : undefined;
  }, [structure, isBlitz]);

  const handleViewStructure = useCallback(() => {
    if (!structure) return;
    goToStructure(structureEntityId, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), false);
  }, [goToStructure, structure, structureEntityId]);

  return {
    structureEntityId,
    structureEntityIdNumber,
    structureDetails,
    structure,
    resources,
    relicEffects,
    playerGuild,
    guards,
    guardSlotsUsed,
    guardSlotsMax,
    addressName,
    ownerDisplayName,
    isMine,
    isAlly,
    hyperstructureRealmCount,
    isHyperstructure,
    isBlitz,
    typeLabel,
    backgroundImage,
    alignmentBadge,
    progress,
    structureName,
    isLoadingStructure,
    isRefreshing,
    handleRefresh,
    lastRefresh,
    handleViewStructure,
  };
};
