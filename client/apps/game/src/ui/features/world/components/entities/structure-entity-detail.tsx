import {
  MAP_DATA_REFRESH_INTERVAL,
  MapDataStore,
  Position,
  getAddressName,
  getBlockTimestamp,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getIsBlitz,
  getStructureArmyRelicEffects,
  getStructureName,
  getStructureRelicEffects,
  getStructureTypeName,
} from "@bibliothecadao/eternum";

import { useGoToStructure } from "@/hooks/helpers/use-navigate";

import { InventoryResources } from "@/ui/features/economy/resources";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { displayAddress } from "@/ui/utils/utils";

import { sqlApi } from "@/services/api";
import { StructureUpgradeButton } from "@/ui/modules/entity-details/components/structure-upgrade-button";
import { useDojo } from "@bibliothecadao/react";
import { getStructureFromToriiClient } from "@bibliothecadao/torii";
import {
  ContractAddress,
  ID,
  MERCENARIES,
  RelicEffectWithEndTick,
  RelicRecipientType,
  StructureType,
} from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader, RefreshCw } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { ImmunityTimer } from "../structures/immunity-timer";
import { ActiveRelicEffects } from "./active-relic-effects";
import { StructureProductionPanel } from "./structure-production-panel";

interface StructureEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const StructureEntityDetail = memo(
  ({
    structureEntityId,
    className,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: StructureEntityDetailProps) => {
    const {
      network: { toriiClient },
      account,
      setup: { components },
    } = useDojo();

    const userAddress = ContractAddress(account.account.address);
    const [lastRefresh, setLastRefresh] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const structureEntityIdNumber = Number(structureEntityId ?? 0);
    const isBlitz = getIsBlitz();

    const {
      data: structureDetails,
      isLoading: isLoadingStructure,
      refetch: refetchStructure,
      // error: structureError, // Can be used for error UI
    } = useQuery({
      queryKey: ["structureDetails", String(structureEntityId), String(userAddress)],
      queryFn: async () => {
        if (!toriiClient || !structureEntityId || !components || !userAddress) return null;

        const { structure, resources, productionBoostBonus } = await getStructureFromToriiClient(
          toriiClient,
          structureEntityId,
        );
        const relicEffects: RelicEffectWithEndTick[] = [];
        const { currentArmiesTick } = getBlockTimestamp();
        if (structure) {
          relicEffects.push(...getStructureArmyRelicEffects(structure, currentArmiesTick));
        }
        if (productionBoostBonus) {
          relicEffects.push(...getStructureRelicEffects(productionBoostBonus, currentArmiesTick));
        }
        if (!structure)
          return {
            structure: null,
            resources: null,
            playerGuild: undefined,
            guards: [],
            isAlly: false,
            addressName: MERCENARIES,
            isMine: false,
            hyperstructureRealmCount: undefined,
          };

        const isMine = structure.owner === userAddress;
        const guild = getGuildFromPlayerAddress(ContractAddress(structure.owner), components);
        const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);
        const userGuild = getGuildFromPlayerAddress(userAddress, components);
        const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;
        const addressName = structure.owner ? getAddressName(structure.owner, components) : MERCENARIES;

        // Get hyperstructure realm count if this is a hyperstructure
        const hyperstructureRealmCount =
          structure.base.category === StructureType.Hyperstructure
            ? MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi).getHyperstructureRealmCount(
                structure.entity_id,
              )
            : undefined;

        return {
          structure,
          resources,
          playerGuild: guild,
          guards,
          isAlly,
          addressName,
          isMine,
          relicEffects,
          hyperstructureRealmCount,
        };
      },
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
        await refetchStructure();
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000); // Show loading for at least 1 second
      }
    }, [lastRefresh, refetchStructure]);

    const structure = structureDetails?.structure;
    const resources = structureDetails?.resources;
    const playerGuild = structureDetails?.playerGuild;
    const guards = structureDetails?.guards || [];
    const addressName = structureDetails?.addressName;
    const isMine = structureDetails?.isMine || false;
    const isAlly = structureDetails?.isAlly || false;
    const hyperstructureRealmCount = structureDetails?.hyperstructureRealmCount;

    const ownerHex = structure?.owner ? `0x${structure.owner.toString(16)}` : undefined;
    const ownerDisplayName = addressName || displayAddress(ownerHex ?? "0x0");

    const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

    const goToStructure = useGoToStructure();

    const typeLabel = useMemo(() => {
      if (!structure?.base?.category) return undefined;
      return getStructureTypeName(structure.base.category as StructureType, isBlitz);
    }, [structure?.base?.category, isBlitz]);

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
          return "/images/buildings/construction/camp.png";
        case StructureType.Bank:
          return "/images/buildings/construction/bank.png";
        default:
          return undefined;
      }
    }, [structure?.base?.category, structure?.base?.level]);

    const guardSlotsUsed =
      structure?.base.troop_guard_count !== undefined ? Number(structure.base.troop_guard_count) : undefined;
    const guardSlotsMax =
      structure?.base.troop_max_guard_count !== undefined ? Number(structure.base.troop_max_guard_count) : undefined;

    const alignmentBadge = useMemo(() => {
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

    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const panelClass = "rounded-lg border border-gold/20 bg-dark-brown/70 px-3 py-2 shadow-md";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;
    const actionButtonBase =
      "inline-flex min-w-[104px] items-center justify-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-60";
    const standardActionClasses = `${actionButtonBase} border border-gold/60 bg-gold/10 text-gold hover:bg-gold/20`;

    const structureName = useMemo(() => {
      return structure ? getStructureName(structure, isBlitz).name : undefined;
    }, [structure, isBlitz]);

    if (isLoadingStructure) {
      return (
        <div className="flex items-center justify-center h-full mt-2 ">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"} ${className ?? ""}`}>
        <div
          className={`relative overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-dark-brown/90 via-brown/75 to-dark/80 ${
            compact ? "px-3 py-3" : "px-4 py-4"
          }`}
        >
          {backgroundImage && (
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 pointer-events-none"
              style={{ backgroundImage: `url(${backgroundImage})` }}
              aria-hidden="true"
            />
          )}
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col flex-1 min-w-0 gap-1">
                {typeLabel && (
                  <span className={`${smallTextClass} uppercase tracking-[0.22em] text-gold/70`}>{typeLabel}</span>
                )}
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-gold`}>{structureName}</h4>
                  <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">#{structure.entity_id}</span>
                </div>
                <div className={`${smallTextClass} text-gold/70`}>Owner · {ownerDisplayName}</div>
                {playerGuild && <div className={`${smallTextClass} text-gold/60`}>Guild · {playerGuild.name}</div>}
              </div>
              <div className="flex flex-col items-end gap-2">
                {alignmentBadge && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xxs font-semibold uppercase tracking-[0.25em] ${alignmentBadge.className}`}
                    >
                      {alignmentBadge.label}
                    </span>
                  </div>
                )}
                {showButtons && (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1 rounded-md border border-gold/30 bg-dark/60 px-1.5 py-1 shadow-sm">
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || Date.now() - lastRefresh < 10000}
                        className={standardActionClasses}
                        title="Refresh data"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      </button>
                      {isMine && (
                        <button
                          onClick={() =>
                            goToStructure(
                              structureEntityId,
                              new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
                              false,
                            )
                          }
                          className={standardActionClasses}
                          title="View structure"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {structureEntityIdNumber > 0 && (
                      <StructureUpgradeButton
                        structureEntityId={structureEntityIdNumber}
                        className="min-w-[110px] justify-center px-3 py-1"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"} w-full`}>
          {isHyperstructure && hyperstructureRealmCount !== undefined && (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Hyperstructure Status</div>
              <HyperstructureVPDisplay
                realmCount={hyperstructureRealmCount}
                isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
                className="mt-0"
              />
            </div>
          )}

          {isHyperstructure && !isBlitz && (
            <div className={panelClass}>
              <div className="flex items-center justify-between">
                <div className={sectionTitleClass}>Construction Progress</div>
                <div className="text-xs font-semibold bg-gold/20 px-2 py-1 rounded-full">
                  {progress?.percentage ?? 0}%
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-dark/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold via-brilliance to-lightest transition-all duration-500"
                  style={{ width: `${progress?.percentage ?? 0}%` }}
                />
              </div>
              {progress?.percentage !== 100 && (
                <div className="mt-1 text-xxs text-gold/60 italic text-center">
                  {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                </div>
              )}
            </div>
          )}

          <div className={panelClass}>
            <div className={`${sectionTitleClass} mb-2`}>Defenses</div>
            {guardSlotsUsed !== undefined && guardSlotsMax !== undefined && (
              <div className={`${smallTextClass} text-gold/60 mb-2`}>
                Slots: {guardSlotsUsed}/{guardSlotsMax}
              </div>
            )}
            {guards.length > 0 ? (
              <CompactDefenseDisplay
                troops={guards.map((army) => ({
                  slot: army.slot,
                  troops: army.troops,
                }))}
              />
            ) : (
              <div className={`${smallTextClass} text-gold/60 italic`}>No defenders stationed.</div>
            )}
          </div>

          {resources ? (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Buildings & Production</div>
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact={compact}
                smallTextClass={smallTextClass}
              />
            </div>
          ) : (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-1`}>Buildings & Production</div>
              <div className={`${smallTextClass} text-gold/60 italic`}>Buildings & Production data unavailable.</div>
            </div>
          )}

          <div className={panelClass}>
            <div className={`${sectionTitleClass} mb-2`}>Resources & Relics</div>
            {resources ? (
              <InventoryResources
                relicEffects={structureDetails?.relicEffects.map((effect) => effect.id) || []}
                max={maxInventory}
                resources={resources}
                className="flex flex-wrap gap-1 w-full no-scrollbar"
                resourcesIconSize={compact ? "xs" : "sm"}
                textSize={compact ? "xxs" : "xs"}
                entityId={structureEntityId}
                entityOwnerId={structureEntityId}
                recipientType={RelicRecipientType.Structure}
                activateRelics={showButtons && isMine}
              />
            ) : (
              <div className={`${smallTextClass} text-gold/60 italic`}>No resources stored.</div>
            )}
          </div>

          {structureDetails?.relicEffects && structureDetails.relicEffects.length > 0 && (
            <div className={panelClass}>
              <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
              <ActiveRelicEffects
                relicEffects={structureDetails.relicEffects}
                entityId={structureEntityId}
                compact={compact}
              />
            </div>
          )}
        </div>

        <div className={`${panelClass} mt-1`}>
          <ImmunityTimer structure={structure} />
        </div>
      </div>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
