import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { realmMeaning, readStructureMeaning, mineMeaning } from "@/ui/design-system/domain-icon-meaning";
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
import { useNativeRowOrAbsent, useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ContractAddress, ID, RelicEffect, StructureType } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { presentedMineKind } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { structureGuardSlots } from "@/ui/features/military/utils/defense-slot-utils";

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
  const facts = useNativeFacts([
    "GuildMember",
    "Guild",
    "Guard",
    "Hyperstructure",
    "HyperstructureProgress",
    "HyperstructureShares",
    "Structure",
    "GameRegistry",
    "ExpeditionSite",
    "SliceRules",
    "SettlementRules",
    "DepthRules",
  ]);
  const playerGuild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), store) : undefined;
  const guards = structure ? getGuardsByStructure(structure, store) : [];
  const isMine = isViewerOwner(structure?.owner, userAddress);
  const ownerDisplayName = usePlayerDisplayName(structure?.owner ?? 0n) ?? "";
  const timestamp = useCurrentDefaultTick();
  const relicEffects: RelicEffect[] = useMemo(() => {
    const effects: RelicEffect[] = [];
    if (structure) {
      for (const guard of facts.store.inGame("Guard", structure.game_id)) {
        if (guard.structure_id === structure.entity_id) effects.push(...getStructureArmyRelicEffects(guard, timestamp));
      }
    }
    if (productionBoostBonus) effects.push(...getStructureRelicEffects(productionBoostBonus, timestamp));
    return effects;
  }, [productionBoostBonus, structure, facts, timestamp]);
  const structureDetails = structure ? { structure, resources, playerGuild, guards, isMine, relicEffects } : null;
  // The rate the map's label shows too: what it pays its holder, or what taking it would pay.
  const hyperstructureRate = useMemo(
    () =>
      structure?.base.category === StructureType.Hyperstructure
        ? getHyperstructureRates(facts.store).get(structureEntityId)
        : undefined,
    [structure, structureEntityId, facts],
  );

  const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return mode.structure.getTypeName(structure.base.category as StructureType, presentedMineKind(structure));
  }, [mode, structure]);

  const backgroundImage = useMemo(() => {
    if (!structure?.base?.category) return undefined;

    return iconUrl(
      structure.base.category === StructureType.Realm
        ? realmMeaning(structure.base.level)
        : structure.base.category === StructureType.Mine
          ? mineMeaning(structure.metadata.mine_kind)
          : readStructureMeaning(facts.store, structure),
      256,
    );
  }, [structure, facts]);

  const guardSlots = structureGuardSlots(structure);

  const progress = useMemo(() => {
    return isHyperstructure && structure
      ? getHyperstructureProgress(safeInteger(structure.entity_id), facts.store)
      : undefined;
  }, [isHyperstructure, structure, facts]);

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
    guardSlots,
    ownerDisplayName,
    isMine,
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
