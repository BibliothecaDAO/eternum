import {
  getAddressName,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getStructureArmyRelicEffects,
  getStructureName,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";

import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { getIsBlitz, MAP_DATA_REFRESH_INTERVAL, MapDataStore, Position } from "@bibliothecadao/eternum";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { ActiveResourceProductions, InventoryResources } from "@/ui/features/economy/resources";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { useRealtimeChatActions } from "@/ui/features/social/realtime-chat/hooks/use-realtime-chat";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { displayAddress } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { sqlApi } from "@/services/api";
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
import { Loader, MessageCircle } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { ImmunityTimer } from "../structures/immunity-timer";
import { ActiveRelicEffects } from "./active-relic-effects";
import { StructureUpgradeButton } from "@/ui/modules/entity-details/components/structure-upgrade-button";

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
    const isAlly = structureDetails?.isAlly || false;
    const addressName = structureDetails?.addressName;
    const isMine = structureDetails?.isMine || false;
    const hyperstructureRealmCount = structureDetails?.hyperstructureRealmCount;

    const isRealmOrVillage =
      structure?.base.category === StructureType.Realm || structure?.base.category === StructureType.Village;
    const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

    const goToStructure = useGoToStructure();

    const progress = useMemo(() => {
      return isHyperstructure ? getHyperstructureProgress(structure?.entity_id, components) : undefined;
    }, [isHyperstructure, structure?.entity_id, components]);

    // Precompute common class strings for consistency with ArmyEntityDetail
    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const panelClass = "bg-dark-brown/60 rounded p-2 border border-gold/20";

    const realtimeChatActions = useRealtimeChatActions();

    const targetPlayerId = useMemo(() => {
      const trimmedName = addressName?.trim();
      if (trimmedName) {
        return trimmedName;
      }
      if (structure?.owner !== undefined) {
        return `0x${structure.owner.toString(16).padStart(64, "0")}`;
      }
      return undefined;
    }, [addressName, structure?.owner]);

    const handleChatClick = () => {
      if (isMine) {
        realtimeChatActions.setShellOpen(true);
        return;
      }
      if (!targetPlayerId) {
        realtimeChatActions.setShellOpen(true);
        return;
      }
      realtimeChatActions.openDirectThread(targetPlayerId);
    };

    const structureName = useMemo(() => {
      return structure ? getStructureName(structure, getIsBlitz()).name : undefined;
    }, [structure]);

    if (isLoadingStructure) {
      return (
        <div className="flex items-center justify-center h-full mt-2 ">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
        <div className="flex items-center justify-between border-b border-gold/30 pb-2 gap-2">
          <div className="flex flex-col flex-1 min-w-0">
            <h4 className={`${compact ? "text-base" : "text-2xl"}`}>
              {addressName || displayAddress("0x0" + structure?.owner.toString(16) || "0x0")}
            </h4>
            {playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {showButtons && (
              <RefreshButton
                onClick={handleRefresh}
                isLoading={isRefreshing}
                size="sm"
                disabled={Date.now() - lastRefresh < 10000}
              />
            )}
            <div
              className={`px-2 py-1 rounded text-xs h6 border ${
                isAlly ? "bg-ally/80 border-ally text-lightest" : "bg-enemy/80 border-enemy text-lightest"
              }`}
            >
              {isAlly ? "Ally" : "Enemy"}
            </div>
            {addressName !== undefined && showButtons && (
              <>
                {isMine && (
                  <button
                    onClick={() =>
                      goToStructure(
                        structureEntityId,
                        new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
                        false,
                      )
                    }
                    className="px-2 py-1 rounded text-xs bg-gold/20 hover:bg-gold/30 transition"
                  >
                    VIEW
                  </button>
                )}
                <button onClick={handleChatClick} className="p-1 rounded hover:bg-gold/10 transition" title="Chat">
                  <MessageCircle />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
            {/* Structure name and type */}
            <div className="flex flex-col gap-0.5">
              <div className="bg-gold/10 rounded-sm px-2 py-0.5 border-l-4 border-gold">
                <div className="flex items-center justify-between gap-2">
                  <h6 className={`${compact ? "text-base" : "text-lg"} font-bold truncate`}>{structureName}</h6>
                  {showButtons && structureEntityIdNumber > 0 && (
                    <StructureUpgradeButton structureEntityId={structureEntityIdNumber} />
                  )}
                </div>
              </div>

              {/* Hyperstructure VP/s display */}
              {isHyperstructure && hyperstructureRealmCount !== undefined && (
                <HyperstructureVPDisplay
                  realmCount={hyperstructureRealmCount}
                  isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
                />
              )}
            </div>

            {/* Progress bar for hyperstructures */}
            {isHyperstructure && !getIsBlitz() && (
              <div className={`flex flex-col gap-1 mt-1 ${panelClass}`}>
                <div className="flex justify-between items-center">
                  <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Construction Progress</div>
                  <div className="text-xs font-semibold bg-gold/20 px-2 py-0.5 rounded-full">
                    {progress?.percentage ?? 0}%
                  </div>
                </div>
                <div className="w-full /70 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-gold/80 to-gold h-full rounded-full transition-all duration-500 shadow-glow-sm"
                    style={{ width: `${progress?.percentage ?? 0}%` }}
                  />
                </div>
                {progress?.percentage !== 100 && (
                  <div className="text-xxs text-gold/60 italic text-center mt-0.5">
                    {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                  </div>
                )}
              </div>
            )}

            {/* Active resource productions display */}
            {resources && (
              <div className={`mt-1 ${panelClass}`}>
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Active Productions</div>
                <ActiveResourceProductions resources={resources} compact={true} size="xs" />
              </div>
            )}

            {/* Guards/Defense section */}
            {guards.length > 0 && (
              <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
                <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Defense</div>
                <CompactDefenseDisplay
                  troops={guards.map((army) => ({
                    slot: army.slot,
                    troops: army.troops,
                  }))}
                />
              </div>
            )}
          </div>

          {/* Resources section */}
          <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
            <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Resources & Relics</div>
            {resources && (
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
            )}
          </div>

          {/* Active Relic Effects section */}
          {structureDetails?.relicEffects && (
            <ActiveRelicEffects
              relicEffects={structureDetails.relicEffects}
              entityId={structureEntityId}
              compact={compact}
            />
          )}
        </div>

        {/* Immunity timer */}
        <div className="mt-1 border-t border-gold/20 pt-1">
          <ImmunityTimer structure={structure} />
        </div>
      </div>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
