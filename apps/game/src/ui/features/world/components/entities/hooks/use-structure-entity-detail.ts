import { GUARD_MODELS } from "@bibliothecadao/eternum/game-client";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { readStructureMeaning, mineMeaning } from "@/ui/design-system/domain-icon-meaning";
import {
  Position,
  configManager,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  structureMapPosition,
  isViewerOwner,
  REALM_SKIN_MODELS,
} from "@bibliothecadao/eternum";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ContractAddress, ID, StructureType } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { presentedMineKind } from "@bibliothecadao/eternum";
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
  const facts = useNativeFacts([
    "GuildMember",
    "Guild",
    ...GUARD_MODELS,
    "Structure",
    ...REALM_SKIN_MODELS,
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
  const structureDetails = structure ? { structure, resources, playerGuild, guards, isMine } : null;
  const typeLabel = useMemo(() => {
    if (!structure?.base?.category) return undefined;
    return mode.structure.getTypeName(structure.base.category as StructureType, presentedMineKind(structure));
  }, [mode, structure]);

  const backgroundImage = useMemo(() => {
    if (!structure?.base?.category) return undefined;

    return iconUrl(
      structure.base.category === StructureType.Mine
        ? mineMeaning(structure.metadata.mine_kind)
        : readStructureMeaning(facts.store, structure),
      256,
    );
  }, [structure, facts]);

  const guardSlots = structureGuardSlots(structure);

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
    playerGuild,
    guards,
    guardSlots,
    ownerDisplayName,
    isMine,
    typeLabel,
    backgroundImage,
    structureName,
    isLoadingStructure: false,
    handleViewStructure,
  };
};
