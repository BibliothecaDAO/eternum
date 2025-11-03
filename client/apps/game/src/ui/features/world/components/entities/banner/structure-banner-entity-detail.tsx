import { Loader } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { ID, RelicRecipientType } from "@bibliothecadao/types";

import { ActiveRelicEffects } from "../active-relic-effects";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { EntityInventoryTabs } from "../entity-inventory-tabs";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import {
  EntityDetailLayoutProvider,
  EntityDetailLayoutVariant,
  EntityDetailSection,
  EntityDetailStat,
  EntityDetailStatList,
  getDensityTextClasses,
  useEntityDetailLayout,
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

const StructureBannerEntityDetailContent = memo(
  ({
    structureEntityId,
    className,
    maxInventory = Infinity,
    showButtons = false,
  }: Omit<StructureBannerEntityDetailProps, "layoutVariant" | "compact">) => {
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
    const layout = useEntityDetailLayout();

    const containerClass = cn(
      "flex h-full min-h-0 flex-col",
      layout.density === "compact" ? "gap-2" : "gap-3",
      className,
    );

    const wantsGridLayout = layout.variant !== "sidebar";
    const gridContainerClass = wantsGridLayout
      ? "grid flex-1 min-h-0 w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr"
      : "flex flex-col gap-3";

    const subtleTextClass = cn("text-gold/60", getDensityTextClasses(layout.density, "body"));

    const defenseEmptyCopy = layout.minimizeCopy ? "None" : "No defenders stationed.";
    const productionFallbackCopy = layout.minimizeCopy
      ? "Production unavailable"
      : "Buildings & Production data unavailable.";
    const inventoryFallbackCopy = layout.minimizeCopy ? "Empty" : "No resources stored.";

    const cellBaseClass = wantsGridLayout ? "sm:col-span-1 sm:row-span-1" : undefined;
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

    if (!structure || !structureDetails) return null;

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    return (
      <div className={containerClass}>
        {isHyperstructure && hyperstructureRealmCount !== undefined && (
          <EntityDetailSection tone="highlight">
            <HyperstructureVPDisplay
              realmCount={hyperstructureRealmCount}
              isOwned={structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n}
              className="mt-0"
            />
          </EntityDetailSection>
        )}

        {isHyperstructure && !isBlitz && (
          <EntityDetailSection>
            <EntityDetailStatList columns={wantsGridLayout ? 2 : 1} className="items-center">
              <EntityDetailStat
                label="Progress"
                value={`${progress?.percentage ?? 0}%`}
                emphasizeValue
                className="justify-center"
              />
              {progress?.percentage !== 100 && (
                <EntityDetailStat label="Status" value={progress?.percentage === 0 ? "Not started" : "In progress"} />
              )}
            </EntityDetailStatList>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-dark/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold via-brilliance to-lightest transition-all duration-500"
                style={{ width: `${progress?.percentage ?? 0}%` }}
              />
            </div>
          </EntityDetailSection>
        )}

        <div className={gridContainerClass}>
          <EntityDetailSection
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-1 sm:row-start-1", "min-h-0")}
            tone={guards.length > 0 ? "default" : "highlight"}
          >
            {guards.length > 0 ? (
              <CompactDefenseDisplay
                troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
                slotsUsed={guardSlotsUsed}
                slotsMax={guardSlotsMax}
                structureId={Number(structure.entity_id ?? 0)}
                canManageDefense={isMine}
                displayVariant={layout.minimizeCopy ? "tight" : "default"}
              />
            ) : (
              <span className={cn(subtleTextClass, "italic")}>{defenseEmptyCopy}</span>
            )}
          </EntityDetailSection>

          {resources ? (
            <EntityDetailSection
              className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-1", "min-h-0")}
            >
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact={layout.density === "compact"}
                smallTextClass={layout.density === "compact" ? "text-xxs" : "text-xs"}
                showProductionSummary={!layout.minimizeCopy}
              />
            </EntityDetailSection>
          ) : (
            <EntityDetailSection className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-1")}>
              <span className={cn(subtleTextClass, "italic")}>{productionFallbackCopy}</span>
            </EntityDetailSection>
          )}

          {resources ? (
            <EntityDetailSection
              className={cn(
                cellBaseClass,
                "min-h-0 flex flex-col overflow-auto",
                wantsGridLayout && "sm:col-start-1 sm:row-start-2",
              )}
            >
              {layout.minimizeCopy ? (
                <CompactEntityInventory
                  resources={resources}
                  activeRelicIds={activeRelicIds}
                  recipientType={RelicRecipientType.Structure}
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
                    compact={layout.density === "compact"}
                    allowRelicActivation={showButtons && isMine}
                  />
                </div>
              )}
            </EntityDetailSection>
          ) : (
            <EntityDetailSection className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-1 sm:row-start-2")}>
              <span className={cn(subtleTextClass, "italic")}>{inventoryFallbackCopy}</span>
            </EntityDetailSection>
          )}

          <EntityDetailSection
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-2", "min-h-0")}
          />
        </div>

        {relicEffects.length > 0 && !layout.minimizeCopy && (
          <EntityDetailSection>
            <div className="max-h-[240px] overflow-auto pr-1">
              <ActiveRelicEffects
                relicEffects={relicEffects}
                entityId={structureEntityId}
                compact={layout.density === "compact"}
              />
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
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "hud" : "banner");
    const density = compact ? "compact" : "cozy";
    const minimizeCopy = resolvedVariant === "hud" || compact;

    return (
      <EntityDetailLayoutProvider variant={resolvedVariant} density={density} minimizeCopy={minimizeCopy}>
        <StructureBannerEntityDetailContent
          structureEntityId={structureEntityId}
          className={className}
          maxInventory={maxInventory}
          showButtons={showButtons}
        />
      </EntityDetailLayoutProvider>
    );
  },
);

StructureBannerEntityDetail.displayName = "StructureBannerEntityDetail";
