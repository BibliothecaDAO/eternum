import { getIsBlitz } from "@bibliothecadao/eternum";

import { ArmyCapacity } from "@/ui/design-system/molecules/army-capacity";
import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
import { InventoryResources } from "@/ui/features/economy/resources";
import { TroopChip } from "@/ui/features/military";
import { getCharacterName } from "@/utils/agent";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  getAddressName,
  getArmyRelicEffects,
  getGuildFromPlayerAddress,
  getStructureName,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ContractAddress, ID, RelicRecipientType, TroopTier, TroopType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { Loader, RefreshCw, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { ArmyWarning } from "../armies/army-warning";
import { ActiveRelicEffects } from "./active-relic-effects";

interface ArmyEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const ArmyEntityDetail = memo(
  ({
    armyEntityId,
    className,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: ArmyEntityDetailProps) => {
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
      // error: explorerError, // Available if error handling is needed
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
      staleTime: 30000, // 30 seconds
    });

    const explorer = explorerData?.explorer;
    const explorerResources = explorerData?.resources;

    const {
      data: structureData,
      isLoading: isLoadingStructure,
      refetch: refetchStructure,
      // error: structureError, // Available if error handling is needed
    } = useQuery({
      queryKey: ["structure", explorer?.owner ? String(explorer.owner) : undefined],
      queryFn: async () => {
        if (!toriiClient || !explorer?.owner) return undefined;
        return getStructureFromToriiClient(toriiClient, explorer.owner);
      },
      enabled: !!explorer?.owner,
      staleTime: 30000, // 30 seconds
    });

    const handleRefresh = useCallback(async () => {
      const now = Date.now();
      if (now - lastRefresh < 10000) {
        // 10 second cooldown
        return;
      }

      setIsRefreshing(true);
      setLastRefresh(now);

      try {
        await Promise.all([refetchExplorer(), explorer?.owner ? refetchStructure() : Promise.resolve()]);
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000); // Show loading for at least 1 second
      }
    }, [lastRefresh, refetchExplorer, refetchStructure, explorer?.owner]);

    const structure = structureData?.structure;
    const structureResources = structureData?.resources;

    const derivedData = useMemo(() => {
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
        isMine,
        structureOwnerName: structureOwnerName,
      };
    }, [explorer, structure, components, userAddress, armyEntityId]);

    const handleDeleteExplorer = async () => {
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
    };

    const headerTextClass = compact ? "text-base" : "text-lg";
    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const panelClass = "bg-dark-brown/60 rounded p-2 border border-gold/20";
    const actionButtonBase =
      "inline-flex min-w-[104px] items-center justify-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60";
    const standardActionClasses = `${actionButtonBase} border border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 focus:ring-gold/30`;
    const dangerActionClasses = `${actionButtonBase} border border-danger/60 bg-danger/20 text-danger hover:bg-danger/40 focus:ring-danger/40`;

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="flex items-center justify-center h-full mt-2 ">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
        <div className={`flex items-center justify-between border-b border-gold/30 ${compact ? "pb-1" : "pb-2"} gap-2`}>
          <div className="flex flex-col flex-1 min-w-0">
            <h4 className={`${headerTextClass} font-bold`}>
              {derivedData.addressName} <span className="text-xs text-gold/80">({armyEntityId})</span>
            </h4>
            {derivedData.playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {derivedData.playerGuild.name}
                {" >"}
              </div>
            )}
            {derivedData.structureOwnerName && (
              <div className="text-xs text-gold/70 italic">Owner: {derivedData.structureOwnerName}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showButtons && (
              <button
                onClick={handleRefresh}
                className={standardActionClasses}
                disabled={isRefreshing || Date.now() - lastRefresh < 10000}
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            )}
            {derivedData.isMine && showButtons && (
              <button
                onClick={handleDeleteExplorer}
                className={dangerActionClasses}
                title="Delete Army"
                disabled={isLoadingDelete}
              >
                {isLoadingDelete ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Deleting</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
            {/* Army warnings */}
            {structureResources && explorerResources && (
              <ArmyWarning
                army={explorer}
                explorerResources={explorerResources}
                structureResources={structureResources}
              />
            )}

            {/* Stamina and capacity - more prominent */}
            <div className={`flex flex-col gap-1 mt-1 ${panelClass}`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>STAMINA</div>
                {derivedData.stamina && derivedData.maxStamina && (
                  <StaminaResource
                    entityId={armyEntityId}
                    stamina={derivedData.stamina}
                    maxStamina={derivedData.maxStamina}
                    className="flex-1"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>CAPACITY</div>
                <ArmyCapacity resource={explorerResources} />
              </div>
            </div>
          </div>

          {/* Resources section */}
          {explorerResources && (
            <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
              <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Resources & Relics</div>
              <InventoryResources
                resources={explorerResources}
                relicEffects={explorerData?.relicEffects.map((effect) => effect.id)}
                max={maxInventory}
                className="flex flex-wrap gap-1 w-full no-scrollbar"
                resourcesIconSize={compact ? "xs" : "sm"}
                textSize={compact ? "xxs" : "xs"}
                entityId={armyEntityId}
                entityOwnerId={explorer.owner}
                recipientType={RelicRecipientType.Explorer}
                activateRelics={showButtons && derivedData.isMine}
              />
            </div>
          )}

          {/* Active Relic Effects section */}
          {explorerData?.relicEffects && (
            <ActiveRelicEffects relicEffects={explorerData.relicEffects} entityId={armyEntityId} compact={compact} />
          )}

          {/* Troops section */}
          <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
            <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Army Composition</div>
            <TroopChip troops={explorer.troops} iconSize={compact ? "md" : "lg"} />
          </div>
        </div>
      </div>
    );
  },
);
