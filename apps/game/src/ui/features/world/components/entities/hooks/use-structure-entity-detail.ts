import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { realmMeaning, structureMeaning, mineMeaning } from "@/ui/design-system/domain-icon-meaning";
import {
  Position,
  configManager,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getHyperstructureRates,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  structureMapPosition,
  isViewerOwner,
} from "@bibliothecadao/eternum";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRowOrAbsent, useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ContractAddress, ID, RelicEffect, StructureType } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { presentedMineKind } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

interface UseStructureEntityDetailOptions {
  structureEntityId: ID;
}

export const useStructureEntityDetail = ({ structureEntityId }: UseStructureEntityDetailOptions) => {
  const {
    setup,
    setup: { store },
  } = useGame();
  const mode = useGameModeConfig();

  const goToStructure = useGoToStructure(setup);

  const userAddress = useAccountAddress();
  const keys = { game_id: configManager.getActiveGameId(), entity_id: structureEntityId };
  const structure = useNativeRow("Structure", keys);
  const resources = useResourceManager(structureEntityId);
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
  const ownerDisplayName = usePlayerDisplayName(structure?.owner ?? 0n) ?? "";
  const timestamp = useCurrentDefaultTick();
  const relicEffects: RelicEffect[] = useMemo(() => {
    const effects: RelicEffect[] = [];
    if (structure) {
      for (const guard of store.inGame("Guard", structure.game_id)) {
        if (guard.structure_id === structure.entity_id) effects.push(...getStructureArmyRelicEffects(guard, timestamp));
      }
    }
    if (productionBoostBonus) effects.push(...getStructureRelicEffects(productionBoostBonus, timestamp));
    return effects;
  }, [productionBoostBonus, structure, store, revision, timestamp]);
  const structureDetails = structure
    ? { structure, resources, playerGuild, guards, isAlly, isMine, relicEffects }
    : null;
  // The rate the map's label shows too: what it pays its holder, or what taking it would pay.
  const hyperstructureRate = useMemo(
    () =>
      structure?.base.category === StructureType.Hyperstructure
        ? getHyperstructureRates(store).get(structureEntityId)
        : undefined,
    [structure, store, structureEntityId, shares, revision],
  );

  const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return mode.structure.getTypeName(structure.base.category as StructureType, presentedMineKind(structure));
  }, [mode, store, structure]);

  const backgroundImage = useMemo(() => {
    if (!structure?.base?.category) return undefined;

    return iconUrl(
      structure.base.category === StructureType.Realm
        ? realmMeaning(structure.base.level)
        : structure.base.category === StructureType.Mine
          ? mineMeaning(structure.metadata.mine_kind)
          : structureMeaning(structure.base.category),
      256,
    );
  }, [structure]);

  const guardSlotsUsed = structure && guards ? guards.filter((guard) => guard.troops.count > 0n).length : undefined;
  const guardSlotsMax =
    structure?.base.troop_max_guard_count !== undefined ? Number(structure?.base?.troop_max_guard_count) : undefined;

  const progress = useMemo(() => {
    return isHyperstructure && structure
      ? getHyperstructureProgress(safeInteger(structure.entity_id), store)
      : undefined;
  }, [isHyperstructure, structure?.entity_id, store, revision]);

  const structureName = useMemo(() => {
    return structure ? mode.structure.getName(structure).name : undefined;
  }, [mode, structure]);

  const handleViewStructure = useCallback(() => {
    if (!structure) return;
    const site = structureMapPosition(store, structure);
    if (site) goToStructure(structureEntityId, Position.fromContract(site), false);
  }, [goToStructure, store, structure, structureEntityId]);

  return {
    structureEntityId,
    structureDetails,
    structure,
    resources,
    relicEffects,
    playerGuild,
    guards,
    guardSlotsUsed,
    guardSlotsMax,
    ownerDisplayName,
    isMine,
    isAlly,
    hyperstructureRate,
    isHyperstructure,
    typeLabel,
    backgroundImage,
    progress,
    structureName,
    isLoadingStructure: false,
    handleViewStructure,
  };
};
