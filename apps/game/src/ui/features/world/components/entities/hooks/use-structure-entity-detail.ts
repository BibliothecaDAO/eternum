import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { gameEntityKey } from "@/sync/game-scope";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { displayAddress } from "@/ui/utils/utils";
import {
  Position,
  getAddressName,
  getBlockTimestamp,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getRealmCountPerHyperstructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { ContractAddress, ID, BANDITS_NAME, RelicEffectWithEndTick, StructureType } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";

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
    account,
    setup: { components },
  } = useDojo();
  const mode = useGameModeConfig();

  const goToStructure = useGoToStructure(setup);

  const userAddress = ContractAddress(account.account.address);
  const structureEntityIdNumber = Number(structureEntityId ?? 0);
  const recsEntity = gameEntityKey([BigInt(structureEntityIdNumber || 0)]);
  const structure = useComponentValue(components.Structure, recsEntity);
  const resources = useComponentValue(components.Resource, recsEntity);
  const productionBoostBonus = useComponentValue(components.ProductionBoostBonus, recsEntity);
  const playerGuild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
  const userGuild = getGuildFromPlayerAddress(userAddress, components);
  const guards = structure ? getGuardsByStructure(structure) : [];
  const isMine = structure?.owner === userAddress;
  const isAlly = isMine || Boolean(playerGuild && userGuild && playerGuild.entityId === userGuild.entityId);
  const addressName = structure?.owner ? getAddressName(structure.owner, components) : BANDITS_NAME;
  const relicEffects: RelicEffectWithEndTick[] = useMemo(() => {
    const effects: RelicEffectWithEndTick[] = [];
    const { currentArmiesTick } = getBlockTimestamp();
    if (structure) effects.push(...getStructureArmyRelicEffects(structure, currentArmiesTick));
    if (productionBoostBonus) effects.push(...getStructureRelicEffects(productionBoostBonus, currentArmiesTick));
    return effects;
  }, [productionBoostBonus, structure]);
  const structureDetails = structure
    ? { structure, resources, playerGuild, guards, isAlly, addressName, isMine, relicEffects }
    : null;
  const hyperstructureRealmCount =
    structure?.base.category === StructureType.Hyperstructure
      ? getRealmCountPerHyperstructure(components).get(structureEntityId)
      : undefined;

  const ownerHex = structure?.owner ? `0x${structure.owner.toString(16)}` : undefined;
  const ownerDisplayName = addressName || displayAddress(ownerHex ?? "0x0");

  const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return mode.structure.getTypeName(structure.base.category as StructureType);
  }, [mode, structure?.base?.category]);

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
      case StructureType.Camp:
        return "/images/buildings/construction/camp.png";
      case StructureType.Bank:
        return "/images/buildings/construction/bank.png";
      default:
        return isVillageLikeStructureCategory(structure.base.category)
          ? "/images/buildings/construction/camp.png"
          : undefined;
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
    return structure ? mode.structure.getName(structure).name : undefined;
  }, [mode, structure]);

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
    typeLabel,
    backgroundImage,
    alignmentBadge,
    progress,
    structureName,
    isLoadingStructure: false,
    handleViewStructure,
  };
};
