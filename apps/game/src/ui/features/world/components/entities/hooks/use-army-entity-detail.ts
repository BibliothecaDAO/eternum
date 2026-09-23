import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import {
  configManager,
  getExplorerOwner,
  getArmyName,
  getArmyRelicEffects,
  getGuildFromPlayerAddress,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { buildProjectedStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import type { ArmyStaminaPresentation } from "@/lib/army-stamina/types";
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
    account: { account },
    setup: {
      store,
      systemCalls: { explorer_delete },
    },
  } = useGame();
  const mode = useGameModeConfig();

  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const userAddress = ContractAddress(account.address);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const explorer = useNativeRow("ExplorerTroops", {
    game_id: configManager.getActiveGameId(),
    explorer_id: armyEntityId,
  });
  const explorerResources = useResourceManager(armyEntityId);
  const structure = useNativeRow(
    "Structure",
    explorer ? { game_id: configManager.getActiveGameId(), entity_id: explorer.owner } : undefined,
  );
  const structureResources = useResourceManager(explorer?.owner ?? 0);
  const ownershipRevision = useNativeRevision(["GuildMember", "Guild", "EntityName"]);
  const owner = explorer ? getExplorerOwner(store, explorer) : 0n;

  const staminaSnapshot = useMemo(() => {
    return getExplorerStaminaSnapshot({
      entityId: armyEntityId,
      currentArmiesTick,
      liveTroops: explorer?.troops,
    });
  }, [armyEntityId, currentArmiesTick, explorer?.troops]);

  const currentTroops = staminaSnapshot?.troops ?? null;
  const relicEffects = useMemo(
    () => (currentTroops ? getArmyRelicEffects(currentTroops, currentArmiesTick) : []),
    [currentArmiesTick, currentTroops],
  );

  const ownerProfile = usePlayerProfile(owner);
  const derivedData: DerivedArmyData | undefined = useMemo(() => {
    if (!explorer) return undefined;

    const maxStamina = staminaSnapshot?.max ?? 0;
    const stamina = staminaSnapshot?.stamina ?? { amount: 0n, updated_tick: 0n };
    const staminaDisplay = staminaSnapshot
      ? buildProjectedStaminaDisplayModel({
          committedCurrent: staminaSnapshot.current,
          committedMax: maxStamina,
          armiesTickTimeRemaining,
          currentArmiesTick,
          troops: staminaSnapshot.troops,
        })
      : null;

    const guild = owner ? getGuildFromPlayerAddress(owner, store) : undefined;
    const isMine = owner === userAddress;

    const addressName = owner ? (ownerProfile.name ?? undefined) : getArmyName(armyEntityId, store);

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
    armyEntityId,
    store,
    owner,
    ownershipRevision,
    currentArmiesTick,
    explorer,
    mode,
    ownerProfile.name,
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
    isLoadingExplorer: explorer === undefined,
    isLoadingStructure: explorer?.owner !== undefined && structure === undefined,
    handleDeleteExplorer,
    isLoadingDelete,
  };
};
