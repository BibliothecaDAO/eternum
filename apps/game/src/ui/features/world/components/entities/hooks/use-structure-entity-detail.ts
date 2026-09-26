import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import {
  Position,
  configManager,
  displayPlayerName,
  getBlockTimestamp,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getRealmCountPerHyperstructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  structureMapPosition,
  isViewerOwner,
} from "@bibliothecadao/eternum";
import { hyperstructurePointsPerSecond as sharedPointsPerSecond } from "@bibliothecadao/eternum/game-sync";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRowOrAbsent, useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ContractAddress, ID, BANDITS_NAME, RelicEffectWithEndTick, StructureType } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { presentedMineKind } from "@bibliothecadao/eternum";

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
    setup: { store },
  } = useGame();
  const mode = useGameModeConfig();

  const goToStructure = useGoToStructure(setup);

  const userAddress = useAccountAddress();
  const structureEntityIdNumber = Number(structureEntityId ?? 0);
  const keys = { game_id: configManager.getActiveGameId(), entity_id: structureEntityIdNumber };
  const structure = useNativeRow("Structure", keys);
  const resources = useResourceManager(structureEntityIdNumber);
  const productionBoostBonus = useNativeRowOrAbsent("ProductionBonus", structure ? keys : undefined);
  const shares = useNativeRow("HyperstructureShares", keys);
  const revision = useNativeRevision([
    "GuildMember",
    "Guild",
    "Guard",
    "Hyperstructure",
    "HyperstructureProgress",
    "Structure",
  ]);
  const playerGuild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), store) : undefined;
  const userGuild = userAddress === null ? undefined : getGuildFromPlayerAddress(userAddress, store);
  const guards = structure ? getGuardsByStructure(structure, store) : [];
  const isMine = isViewerOwner(structure?.owner, userAddress);
  const isAlly = isMine || Boolean(playerGuild && userGuild && playerGuild.entityId === userGuild.entityId);
  const ownerProfile = usePlayerProfile(structure?.owner);
  const addressName = structure?.owner ? (ownerProfile.name ?? undefined) : BANDITS_NAME;
  const relicEffects: RelicEffectWithEndTick[] = useMemo(() => {
    const effects: RelicEffectWithEndTick[] = [];
    const { currentArmiesTick } = getBlockTimestamp();
    if (structure) {
      for (const guard of store.inGame("Guard", structure.game_id)) {
        if (guard.structure_id === structure.entity_id)
          effects.push(...getStructureArmyRelicEffects(guard, currentArmiesTick));
      }
    }
    if (productionBoostBonus) effects.push(...getStructureRelicEffects(productionBoostBonus, currentArmiesTick));
    return effects;
  }, [productionBoostBonus, structure, store, revision]);
  const structureDetails = structure
    ? { structure, resources, playerGuild, guards, isAlly, addressName, isMine, relicEffects }
    : null;
  const hyperstructureRealmCount =
    structure?.base.category === StructureType.Hyperstructure
      ? getRealmCountPerHyperstructure(store).get(structureEntityId)
      : undefined;
  // The realm count only feeds the multiplier at claim time, so the panel reads the multiplier the chain holds. A
  // hyperstructure with no share allocation yet grants nothing and shows no rate.
  const hyperstructurePointsPerSecond =
    structure?.base.category === StructureType.Hyperstructure && shares
      ? Number(
          sharedPointsPerSecond(
            store.require("SliceRules", { game_id: keys.game_id }).victory_points_grant_config.hyp_points_per_second,
            shares.multiplier,
          ),
        ) / 1_000_000
      : undefined;

  const ownerDisplayName = structure?.owner ? displayPlayerName(structure.owner, ownerProfile.name) : BANDITS_NAME;

  const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return mode.structure.getTypeName(structure.base.category as StructureType, presentedMineKind(store, structure));
  }, [mode, store, structure]);

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
      case StructureType.Mine:
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

  const guardSlotsUsed = structure && guards ? guards.filter((guard) => guard.troops.count > 0n).length : undefined;
  const guardSlotsMax =
    structure?.base.troop_max_guard_count !== undefined ? Number(structure?.base?.troop_max_guard_count) : undefined;

  const alignmentBadge: AlignmentBadge | undefined = useMemo(() => {
    if (!structure) return undefined;

    const ownerValue = structure.owner;
    const isUnclaimed = ownerValue === 0n;

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
    return isHyperstructure ? getHyperstructureProgress(structure?.entity_id, store) : undefined;
  }, [isHyperstructure, structure?.entity_id, store, revision]);

  const structureName = useMemo(() => {
    return structure ? mode.structure.getName(structure).name : undefined;
  }, [mode, structure]);

  const handleViewStructure = useCallback(() => {
    if (!structure) return;
    goToStructure(structureEntityId, Position.fromContract(structureMapPosition(store, structure)), false);
  }, [goToStructure, store, structure, structureEntityId]);

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
    hyperstructurePointsPerSecond,
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
