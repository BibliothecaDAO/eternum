import { Loader } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";

import { CompactStructureInfo } from "@/ui/features/military/components/compact-structure-info";
import { ActiveRelicEffects } from "../active-relic-effects";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { EntityInventoryTabs } from "../entity-inventory-tabs";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import {
  EntityDetailLayoutVariant,
  EntityDetailSection,
  EntityDetailStat,
  EntityDetailStatList,
  getLayoutTextClasses,
} from "../layout";
import { StructureProductionPanel } from "../structure-production-panel";

export interface StructureBannerEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface StructureBannerEntityDetailContentProps extends Omit<StructureBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const StructureBannerEntityDetailContent = memo(
  ({
    structureEntityId,
    className,
    maxInventory = Infinity,
    showButtons = false,
    compact = true,
    variant,
  }: StructureBannerEntityDetailContentProps) => {
    const {
      structure,
      ownerDisplayName,
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
    const isBanner = variant === "banner";
    const isCompactLayout = compact;

    const containerClass = cn("flex h-full min-h-0 flex-col", isCompactLayout ? "gap-2" : "gap-3", className);

    const wantsGridLayout = true;
    const gridContainerClass = wantsGridLayout
      ? "grid flex-1 min-h-0 w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr"
      : "flex flex-col gap-3";

    const subtleTextClass = cn("text-gold/60", getLayoutTextClasses(isCompactLayout, "body"));
    const emptyTextClass = cn(getLayoutTextClasses(isCompactLayout, "body"), "text-gold/60 italic");

    const defenseEmptyCopy = isBanner ? "None" : "No defenders stationed.";
    const productionFallbackCopy = isBanner ? "Production unavailable" : "Buildings & Production data unavailable.";
    const inventoryFallbackCopy = isBanner ? "Empty" : "No resources stored.";

    const cellBaseClass = wantsGridLayout ? "sm:col-span-1 sm:row-span-1" : undefined;
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);
    const defenseDisplayVariant: EntityDetailLayoutVariant = isBanner || isCompactLayout ? "banner" : "default";

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;

    return (
      <div className={containerClass}>
        <div className={gridContainerClass}>
          <EntityDetailSection
            compact={compact}
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-1 sm:row-start-1", "min-h-0")}
            tone={guards.length > 0 ? "default" : "highlight"}
          >
            <div className="flex flex-row gap-2">
              <CompactStructureInfo isMine={isMine} ownerDisplayName={ownerDisplayName} structure={structure} />
              {guards.length > 0 ? (
                <CompactDefenseDisplay
                  troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
                  slotsUsed={guardSlotsUsed}
                  slotsMax={guardSlotsMax}
                  structureId={Number(structure.entity_id ?? 0)}
                  canManageDefense={isMine}
                  variant={defenseDisplayVariant}
                />
              ) : (
                <p className={emptyTextClass}>{defenseEmptyCopy}</p>
              )}
            </div>
          </EntityDetailSection>

          {isHyperstructure ? (
            <EntityDetailSection
              compact={compact}
              className={cn(
                cellBaseClass,
                wantsGridLayout && "sm:col-start-2 sm:row-start-1",
                "min-h-0 flex flex-col gap-3",
              )}
              tone="highlight"
            >
              {hyperstructureRealmCount !== undefined && (
                <HyperstructureVPDisplay
                  realmCount={hyperstructureRealmCount}
                  isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
                  className="mt-0"
                />
              )}

              {!isBlitz && (
                <div className="flex flex-col gap-2">
                  <EntityDetailStatList compact={compact} columns={wantsGridLayout ? 2 : 1} className="items-center">
                    <EntityDetailStat
                      compact={compact}
                      label="Progress"
                      value={`${progress?.percentage ?? 0}%`}
                      emphasizeValue
                      className="justify-center"
                    />
                    {progress?.percentage !== 100 && (
                      <EntityDetailStat
                        compact={compact}
                        label="Status"
                        value={progress?.percentage === 0 ? "Not started" : "In progress"}
                      />
                    )}
                  </EntityDetailStatList>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dark/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold via-brilliance to-lightest transition-all duration-500"
                      style={{ width: `${progress?.percentage ?? 0}%` }}
                    />
                  </div>
                </div>
              )}
            </EntityDetailSection>
          ) : resources ? (
            <EntityDetailSection
              compact={compact}
              className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-1", "min-h-0")}
            >
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact={isCompactLayout}
                smallTextClass={isCompactLayout ? "text-xxs" : "text-xs"}
                showProductionSummary={!isBanner}
                showTooltip={false}
              />
            </EntityDetailSection>
          ) : (
            <EntityDetailSection
              compact={compact}
              className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-1")}
            >
              <p className={emptyTextClass}>{productionFallbackCopy}</p>
            </EntityDetailSection>
          )}

          {resources ? (
            <EntityDetailSection
              compact={compact}
              className={cn(
                cellBaseClass,
                "min-h-0 flex flex-col overflow-auto",
                wantsGridLayout && "sm:col-start-1 sm:row-start-2",
              )}
            >
              {isBanner ? (
                <CompactEntityInventory
                  resources={resources}
                  activeRelicIds={activeRelicIds}
                  recipientType={RelicRecipientType.Structure}
                  entityId={structureEntityId}
                  entityType={EntityType.STRUCTURE}
                  allowRelicActivation={isMine}
                  variant="tight"
                  maxItems={maxInventory}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-auto pr-1">
                  <EntityInventoryTabs
                    resources={resources}
                    activeRelicIds={activeRelicIds}
                    entityId={structureEntityId}
                    entityOwnerId={structureEntityId}
                    recipientType={RelicRecipientType.Structure}
                    maxItems={maxInventory}
                    compact={isCompactLayout}
                    allowRelicActivation={showButtons && isMine}
                  />
                </div>
              )}
            </EntityDetailSection>
          ) : (
            <EntityDetailSection
              compact={compact}
              className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-1 sm:row-start-2")}
            >
              <p className={emptyTextClass}>{inventoryFallbackCopy}</p>
            </EntityDetailSection>
          )}

          <EntityDetailSection
            compact={compact}
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-2", "min-h-0")}
          />
        </div>

        {relicEffects.length > 0 && !isBanner && (
          <EntityDetailSection compact={compact}>
            <div className="max-h-[240px] overflow-auto pr-1">
              <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact={isCompactLayout} />
            </div>
          </EntityDetailSection>
        )}
      </div>
    );
  },
);
StructureBannerEntityDetailContent.displayName = "StructureBannerEntityDetailContent";

export const StructureBannerEntityDetail = memo(
  ({
    structureEntityId,
    className,
    compact = true,
    maxInventory = Infinity,
    showButtons = false,
    layoutVariant,
  }: StructureBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <StructureBannerEntityDetailContent
        structureEntityId={structureEntityId}
        className={className}
        maxInventory={maxInventory}
        showButtons={showButtons}
        compact={compact}
        variant={resolvedVariant}
      />
    );
  },
);

StructureBannerEntityDetail.displayName = "StructureBannerEntityDetail";
