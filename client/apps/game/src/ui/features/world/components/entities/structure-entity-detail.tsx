import { Eye, Loader, RefreshCw } from "lucide-react";
import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { StructureUpgradeButton } from "@/ui/modules/entity-details/components/structure-upgrade-button";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import { ImmunityTimer } from "../structures/immunity-timer";
import { ActiveRelicEffects } from "./active-relic-effects";
import { EntityInventoryTabs } from "./entity-inventory-tabs";
import { StructureProductionPanel } from "./structure-production-panel";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useStructureEntityDetail } from "./hooks/use-structure-entity-detail";

export interface StructureEntityDetailProps {
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
    const { setup } = useDojo();
    const mode = useGameModeConfig();
    const {
      structure,
      structureDetails,
      resources,
      relicEffects,
      playerGuild,
      guards,
      guardSlotsUsed,
      guardSlotsMax,
      ownerDisplayName,
      isMine,
      hyperstructureRealmCount,
      isHyperstructure,
      typeLabel,
      backgroundImage,
      alignmentBadge,
      progress,
      structureName,
      isLoadingStructure,
      isRefreshing,
      handleRefresh,
      lastRefresh,
      handleViewStructure,
      structureEntityIdNumber,
    } = useStructureEntityDetail({ structureEntityId });
    const goToStructure = useGoToStructure(setup);

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;

    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;
    const headerCardClass = cn(
      "relative overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-dark-brown/90 via-brown/75 to-dark/80",
      compact ? "px-3 py-3" : "px-4 py-4",
    );
    const panelClasses = (...extras: Array<string | false | undefined>) =>
      cn("rounded-lg border border-gold/20 bg-dark-brown/70 shadow-md", compact ? "px-3 py-2" : "px-4 py-3", ...extras);
    const sectionsLayoutClass = `flex flex-col ${compact ? "gap-2" : "gap-3"} w-full`;
    const actionButtonBase =
      "inline-flex min-w-[104px] items-center justify-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-60";
    const standardActionClasses = `${actionButtonBase} border border-gold/60 bg-gold/10 text-gold hover:bg-gold/20`;

    return (
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-3", className)}>
        <div className={headerCardClass}>
          {backgroundImage && (
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25"
              style={{ backgroundImage: `url(${backgroundImage})` }}
              aria-hidden="true"
            />
          )}
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex flex-1 flex-col gap-1">
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
                      <button
                        onClick={() =>
                          void goToStructure(
                            structureEntityId,
                            new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
                            false,
                            { spectator: !isMine },
                          )
                        }
                        className={standardActionClasses}
                        title={isMine ? "View structure" : "Spectate structure"}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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

        <div className={sectionsLayoutClass}>
          {isHyperstructure && hyperstructureRealmCount !== undefined && (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Hyperstructure Status</div>
              <HyperstructureVPDisplay
                realmCount={hyperstructureRealmCount}
                isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
                className="mt-0"
              />
            </div>
          )}

          {isHyperstructure && mode.ui.showHyperstructureProgress && (
            <div className={panelClasses()}>
              <div className="flex items-center justify-between gap-2">
                <div className={sectionTitleClass}>Construction Progress</div>
                <div className="rounded-full bg-gold/20 px-2 py-1 text-xs font-semibold">
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
                <div className="mt-1 text-center text-xxs italic text-gold/60">
                  {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                </div>
              )}
            </div>
          )}

          <div className={panelClasses()}>
            <div className={`${sectionTitleClass} mb-2`}>Defenses</div>
            {guards.length > 0 ? (
              <CompactDefenseDisplay
                troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
                slotsUsed={guardSlotsUsed}
                slotsMax={guardSlotsMax}
                structureId={Number(structure.entity_id ?? 0)}
                canManageDefense={isMine}
                variant={compact ? "banner" : "default"}
              />
            ) : (
              <p className={`${smallTextClass} text-gold/60 italic`}>No defenders stationed.</p>
            )}
          </div>

          {resources ? (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Buildings & Production</div>
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact={compact}
                smallTextClass={smallTextClass}
              />
            </div>
          ) : (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-1`}>Buildings & Production</div>
              <p className={`${smallTextClass} text-gold/60 italic`}>Buildings & Production data unavailable.</p>
            </div>
          )}

          {resources ? (
            <div className={panelClasses("flex flex-col")}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <div className="mt-2">
                <EntityInventoryTabs
                  resources={resources}
                  activeRelicIds={relicEffects.map((effect) => effect.id)}
                  entityId={structureEntityId}
                  entityOwnerId={structureEntityId}
                  recipientType={RelicRecipientType.Structure}
                  maxItems={maxInventory}
                  compact={compact}
                  allowRelicActivation={showButtons && isMine}
                />
              </div>
            </div>
          ) : (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <p className={`${smallTextClass} text-gold/60 italic`}>No resources stored.</p>
            </div>
          )}

          {relicEffects.length > 0 && (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
              <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact={compact} />
            </div>
          )}

          <div className={panelClasses("mt-1")}>
            <ImmunityTimer structure={structure} />
          </div>
        </div>
      </div>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
