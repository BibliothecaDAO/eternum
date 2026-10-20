import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import {
  configManager,
  getExplorerOwner,
  getArmyRelicEffects,
  getGuildFromPlayerAddress,
  isViewerOwner,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ID } from "@bibliothecadao/types";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import type { ArmyStaminaPresentation } from "@/lib/army-stamina/types";
import { useCallback, useMemo, useState } from "react";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

interface UseArmyEntityDetailOptions {
  armyEntityId: ID;
}

interface DerivedArmyData {
  stamina: { amount: bigint };
  maxStamina: number;
  staminaDisplay: ArmyStaminaPresentation | null;
  playerGuild?: { name: string } | undefined;
  /** The army's owner by the one owner rule: the Vanguard when no player holds it. */
  addressName: string;
  isMine: boolean;
  structureOwnerName?: string;
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

  const timestamp = useCurrentDefaultTick();
  const userAddress = useAccountAddress();
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
  const structureResources = useResourceManager(explorer ? safeInteger(explorer.owner) : 0);
  const ownershipRevision = useNativeRevision(["GuildMember", "Guild", "EntityName"]);
  const slotRevision = useNativeRevision(["ArmySlot"]);
  const owner = explorer ? getExplorerOwner(store, explorer) : 0n;

  const staminaSnapshot = useMemo(() => {
    return getExplorerStaminaSnapshot({
      timestamp,
      liveTroops: explorer ? resolveExplorerTroops(store, explorer) : undefined,
    });
  }, [armyEntityId, timestamp, explorer, store, slotRevision]);

  const currentTroops = staminaSnapshot?.troops ?? null;
  const relicEffects = useMemo(
    () => (currentTroops ? getArmyRelicEffects(currentTroops, timestamp) : []),
    [currentTroops, timestamp],
  );

  const addressName = usePlayerDisplayName(owner) ?? "";
  const derivedData: DerivedArmyData | undefined = useMemo(() => {
    if (!explorer) return undefined;

    const maxStamina = staminaSnapshot?.max ?? 0;
    const stamina = staminaSnapshot?.stamina ?? { amount: 0n };
    const staminaDisplay = staminaSnapshot
      ? buildStaminaDisplayModel({
          committedCurrent: staminaSnapshot.current,
          committedMax: maxStamina,
          timestamp,
          troops: staminaSnapshot.troops,
        })
      : null;

    const guild = owner ? getGuildFromPlayerAddress(owner, store) : undefined;
    const isMine = isViewerOwner(owner, userAddress);

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
    timestamp,
    explorer,
    mode,
    addressName,
    staminaSnapshot,
    structure,
    userAddress,
  ]);

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
    isLoadingExplorer: explorer === undefined,
    isLoadingStructure: explorer?.owner !== undefined && structure === undefined,
    handleDeleteExplorer,
    isLoadingDelete,
  };
};
