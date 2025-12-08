import { Loader, RefreshCw, Trash2 } from "lucide-react";
import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ArmyCapacity } from "@/ui/design-system/molecules/army-capacity";
import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
import { TroopChip } from "@/ui/features/military";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import { ArmyWarning } from "../armies/army-warning";
import { ActiveRelicEffects } from "./active-relic-effects";
import { EntityInventoryTabs } from "./entity-inventory-tabs";
import { dangerActionClasses, standardActionClasses } from "./action-button-classes";

import { useArmyEntityDetail } from "./hooks/use-army-entity-detail";

export interface ArmyEntityDetailProps {
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
      explorer,
      explorerResources,
      structure,
      structureResources,
      relicEffects,
      derivedData,
      alignmentBadge,
      isLoadingExplorer,
      isLoadingStructure,
      isRefreshing,
      handleRefresh,
      lastRefresh,
      handleDeleteExplorer,
      isLoadingDelete,
    } = useArmyEntityDetail({ armyEntityId });

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;
    const headerCardClass = cn(
      "relative overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-dark-brown/90 via-brown/75 to-dark/80",
      compact ? "px-3 py-3" : "px-4 py-4",
    );
    const panelClasses = (...extras: Array<string | false | undefined>) =>
      cn("rounded-lg border border-gold/20 bg-dark-brown/70 shadow-md", compact ? "px-3 py-2" : "px-4 py-3", ...extras);
    const sectionsLayoutClass = `flex flex-col ${compact ? "gap-2" : "gap-3"} w-full`;

    return (
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-3", className)}>
        <div className={headerCardClass}>
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex flex-1 flex-col gap-1">
                <span className={`${smallTextClass} uppercase tracking-[0.22em] text-gold/70`}>Army</span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-gold`}>
                    {derivedData.addressName}
                  </h4>
                  <span className="text-xxs uppercase tracking-[0.28em] text-gold/60">#{armyEntityId}</span>
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

        <div className={sectionsLayoutClass}>
          <div className={panelClasses()}>
            <div className={`${sectionTitleClass} mb-2`}>Army Composition</div>
            <TroopChip troops={explorer.troops} size={compact ? "md" : "lg"} />
          </div>

          <div className={panelClasses()}>
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
            <div className={panelClasses("flex flex-col")}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <div className="mt-2">
                <EntityInventoryTabs
                  resources={explorerResources}
                  activeRelicIds={relicEffects.map((effect) => effect.id)}
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
              <ActiveRelicEffects relicEffects={relicEffects} entityId={armyEntityId} compact={compact} />
            </div>
          )}
        </div>
      </div>
    );
  },
);

ArmyEntityDetail.displayName = "ArmyEntityDetail";
