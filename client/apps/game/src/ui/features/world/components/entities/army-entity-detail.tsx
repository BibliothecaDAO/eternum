import { getIsBlitz } from "@bibliothecadao/eternum";

import { ArmyCapacity } from "@/ui/design-system/molecules/army-capacity";
import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
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
import { EntityInventoryTabs } from "./entity-inventory-tabs";

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

    const headerTitleClass = compact ? "text-xl" : "text-2xl";
    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;
    const headerCardClass = `relative overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-dark-brown/90 via-brown/75 to-dark/80 ${compact ? "px-3 py-3" : "px-4 py-4"}`;
    const panelClass = "rounded-lg border border-gold/20 bg-dark-brown/70 px-3 py-2 shadow-md";
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

    const alignmentBadge = derivedData.isMine
      ? { label: "Your Army", className: "bg-gold/20 border border-gold/40 text-gold" }
      : derivedData.playerGuild
        ? {
            label: `Guild · ${derivedData.playerGuild.name}`,
            className: "bg-order-protection/20 border border-order-protection/40 text-order-protection",
          }
        : derivedData.structureOwnerName
          ? { label: "Visiting", className: "bg-blueish/20 border border-blueish/40 text-blueish" }
          : undefined;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"} ${className ?? ""}`}>
        <div className={headerCardClass}>
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col flex-1 min-w-0 gap-1">
                <span className={`${smallTextClass} uppercase tracking-[0.22em] text-gold/70`}>Army</span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className={`${headerTitleClass} font-bold text-gold`}>{derivedData.addressName}</h4>
                  <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">#{armyEntityId}</span>
                </div>
                {derivedData.playerGuild && (
                  <div className={`${smallTextClass} text-gold/60`}>Guild · {derivedData.playerGuild.name}</div>
                )}
                {derivedData.structureOwnerName && (
                  <div className={`${smallTextClass} text-gold/60`}>
                    Stationed at · {derivedData.structureOwnerName}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {alignmentBadge && (
                  <span
                    className={`rounded-full px-3 py-1 text-xxs font-semibold uppercase tracking-[0.25em] ${alignmentBadge.className}`}
                  >
                    {alignmentBadge.label}
                  </span>
                )}
                {showButtons && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button
                      onClick={handleRefresh}
                      className={standardActionClasses}
                      disabled={isRefreshing || Date.now() - lastRefresh < 10000}
                      title="Refresh data"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                    {derivedData.isMine && (
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
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"} w-full`}>
          <div className={panelClass}>
            <div className={`${sectionTitleClass} mb-2`}>Army Composition</div>
            <TroopChip troops={explorer.troops} iconSize={compact ? "md" : "lg"} />
          </div>

          <div className={panelClass}>
            <div className={`${sectionTitleClass} mb-2`}>Vitals</div>
            <div className="flex flex-col gap-2">
              {structureResources && explorerResources && (
                <div className="mb-2">
                  <ArmyWarning
                    army={explorer}
                    explorerResources={explorerResources}
                    structureResources={structureResources}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`${smallTextClass} uppercase text-gold/70`}>Stamina</span>
                {derivedData.stamina && derivedData.maxStamina && (
                  <StaminaResource
                    entityId={armyEntityId}
                    stamina={derivedData.stamina}
                    maxStamina={derivedData.maxStamina}
                    className="flex-1"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`${smallTextClass} uppercase text-gold/70`}>Capacity</span>
                <ArmyCapacity resource={explorerResources} />
              </div>
            </div>
          </div>

          {explorerResources ? (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <EntityInventoryTabs
                resources={explorerResources}
                activeRelicIds={explorerData?.relicEffects.map((effect) => effect.id) ?? []}
                entityId={armyEntityId}
                entityOwnerId={explorer.owner}
                recipientType={RelicRecipientType.Explorer}
                maxItems={maxInventory}
                compact={compact}
                allowRelicActivation={showButtons && derivedData.isMine}
                resourceLabel="Resources"
                relicLabel="Relics"
              />
            </div>
          ) : (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <div className={`${smallTextClass} text-gold/60 italic`}>No resources stored.</div>
            </div>
          )}

          {explorerData?.relicEffects && explorerData.relicEffects.length > 0 && (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
              <ActiveRelicEffects relicEffects={explorerData.relicEffects} entityId={armyEntityId} compact={compact} />
            </div>
          )}
        </div>
      </div>
    );
  },
);
