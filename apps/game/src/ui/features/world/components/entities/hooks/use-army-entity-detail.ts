import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGameEntityComponentValue } from "@/hooks/helpers/use-game-entity-component-value";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { getCharacterName } from "@/utils/agent";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { getAddressName, getArmyRelicEffects, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";

interface UseArmyEntityDetailOptions {
  armyEntityId: ID;
}

interface StaminaDisplayData {
  isRecharging: boolean;
  displayCurrent: number;
  displayRatio: number;
}

interface DerivedArmyData {
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
  staminaDisplay: StaminaDisplayData | null;
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
      components,
      systemCalls: { explorer_delete },
    },
  } = useDojo();
  const mode = useGameModeConfig();

  const { currentArmiesTick } = useBlockTimestamp();
  const userAddress = ContractAddress(account.address);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const explorer = useGameEntityComponentValue(components.ExplorerTroops, armyEntityId);
  const explorerResources = useGameEntityComponentValue(components.Resource, armyEntityId);
  const structure = useGameEntityComponentValue(components.Structure, explorer?.owner);
  const structureResources = useGameEntityComponentValue(components.Resource, explorer?.owner);

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

  const derivedData: DerivedArmyData | undefined = useMemo(() => {
    if (!explorer) return undefined;

    // staminaSnapshot.current is the computed regen value from
    // StaminaManager.getStamina(troops, currentArmiesTick). Use directly.
    const computedAmount = staminaSnapshot?.current ?? 0;
    const maxStamina = staminaSnapshot?.max ?? 0;
    const stamina = staminaSnapshot?.stamina ?? { amount: 0n, updated_tick: 0n };
    const staminaDisplay: StaminaDisplayData | null = staminaSnapshot
      ? {
          isRecharging: computedAmount >= 0 && computedAmount < maxStamina,
          displayCurrent: computedAmount,
          displayRatio: maxStamina > 0 ? computedAmount / maxStamina : 0,
        }
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
  }, [armyEntityId, components, currentArmiesTick, explorer, mode, staminaSnapshot, structure, userAddress]);

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
