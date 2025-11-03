import { Loader } from "lucide-react";
import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import { ImmunityTimer } from "../../structures/immunity-timer";
import { ActiveRelicEffects } from "../active-relic-effects";
import { EntityInventoryTabs } from "../entity-inventory-tabs";
import { StructureProductionPanel } from "../structure-production-panel";

import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";

export interface StructureBannerEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const StructureBannerEntityDetail = memo(
  ({
    structureEntityId,
    className,
    compact = true,
    maxInventory = Infinity,
    showButtons = false,
  }: StructureBannerEntityDetailProps) => {
    const {
      structure,
      structureDetails,
      resources,
      relicEffects,
      guards,
      guardSlotsUsed,
      guardSlotsMax,
      isMine,
      hyperstructureRealmCount,
      isHyperstructure,
      isBlitz,
      progress,
      isLoadingStructure,
    } = useStructureEntityDetail({ structureEntityId });

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

    const panelClasses = (...extras: Array<string | false | undefined>) =>
      cn("rounded-lg border border-gold/20 bg-dark-brown/70 shadow-md", compact ? "px-3 py-2" : "px-4 py-3", ...extras);
    const sectionsLayoutClass =
      "grid flex-1 min-h-0 w-full grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] auto-rows-min items-stretch";
    return (
      <div className={cn("flex h-full min-h-0 flex-col gap-2 overflow-hidden", compact ? "gap-2" : "gap-3", className)}>
        <div className={sectionsLayoutClass}>
          {isHyperstructure && hyperstructureRealmCount !== undefined && (
            <div className={panelClasses("col-span-2")}>
              <div className={`${sectionTitleClass} mb-2`}>Hyperstructure Status</div>
              <HyperstructureVPDisplay
                realmCount={hyperstructureRealmCount}
                isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
                className="mt-0"
              />
            </div>
          )}

          {isHyperstructure && !isBlitz && (
            <div className={panelClasses("col-span-2")}>
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

          <div className={panelClasses("col-span-1")}>
            {guards.length > 0 ? (
              <CompactDefenseDisplay
                troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
                slotsUsed={guardSlotsUsed}
                slotsMax={guardSlotsMax}
                structureId={Number(structure.entity_id ?? 0)}
                canManageDefense={isMine}
              />
            ) : (
              <div className={`${smallTextClass} italic text-gold/60`}>No defenders stationed.</div>
            )}
          </div>

          {resources ? (
            <div className={panelClasses("col-span-1")}>
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact={compact}
                smallTextClass={smallTextClass}
              />
            </div>
          ) : (
            <div className={panelClasses("col-span-1")}>
              <div className={`${sectionTitleClass} mb-1`}>Buildings & Production</div>
              <div className={`${smallTextClass} italic text-gold/60`}>Buildings & Production data unavailable.</div>
            </div>
          )}

          {resources ? (
            <div className={panelClasses("col-span-2 min-h-0 overflow-hidden flex flex-col")}>
              <div className={cn("mt-2", "min-h-0 flex-1 overflow-auto pr-1")}>
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
            <div className={panelClasses("col-span-2")}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <div className={`${smallTextClass} italic text-gold/60`}>No resources stored.</div>
            </div>
          )}

          {relicEffects.length > 0 && (
            <div className={panelClasses("col-span-2")}>
              <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
              <div className={cn("max-h-[240px] overflow-auto pr-1")}>
                <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact={compact} />
              </div>
            </div>
          )}

          <div className={panelClasses("col-span-2")}>
            <ImmunityTimer structure={structure} />
          </div>
        </div>
      </div>
    );
  },
);

StructureBannerEntityDetail.displayName = "StructureBannerEntityDetail";
